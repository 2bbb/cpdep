#!/usr/bin/env node
'use strict';
const fs = require('fs-extra');
const path = require('path');
const process = require('process');

const program = require('commander');

function assert(cond, text, sig) {
	if(cond) return;
	sig = (sig == undefined) ? -1 : sig;
	console.error(text);
	process.exit(sig);
}

program
	.version('0.0.2')
	.usage('[options] <target ...>')
	.option('-c, --copy', 'copy')
	.option('-s, --save-list <file_name>', 'save dependency list.')
	.option('-r, --root <dir>', 'library root directory. [default: .]')
	.option('-d, --dest <dir>', 'copy destination directory. [default: ./dest]')
	.option('-f, --flatten-directory', 'if include with "local_path", then search recursively after search same directory.')
	.parse(process.argv);

const context = {
	args: program.args,
	doCopy: program.copy ? true : false,
	root: program.root || '.',
	dest: program.dest || './dest',
	save_list: program.saveList,
	flatten: program.flattenDirectory ? true : false,
	depends: []
};

assert(fs.existsSync(context.root), 'root directory [' + context.root + '] is not exist.');

console.log(context.args);

assert(context.args.length != 0, 'argument is not given.');
for(let i = 0; i < context.args.length; i++) {
	assert(fs.existsSync(path.join(context.root, context.args[i])), 'argument at ' + i + ' [' + context.args[i] + '] is not exisit in ' + context.root + ".");
}

if(context.flatten) {
	context.all_files = fs.walkSync(context.root);
}

console.log('project root: ' + context.root);

const re = new RegExp("");
re.compile(/#[ \t\r\n]*include[ \t\r\n]*[<|"]([^>"]+)[>|"]/g);

function analyse(depend) {
	depend.is_searched = true;
	const file_path = depend.is_absolute ? depend.path : path.join(depend.dir, depend.path);
	console.log('analyse ' + file_path + " [" + (depend.original_fragment) + "]");
	let absolute_path = path.join(context.root, file_path);
	if(!fs.existsSync(absolute_path)) {
		console.warn("  !!!! [WARNING] " + file_path + " not found.");
		if(context.flatten && !depend.is_absolute) {
			const flatten_search = context.all_files.filter((file) => {
				return file.indexOf(depend.path.replace(/\.\//g, "")) != -1;
			});
			if(0 == flatten_search.length) {
				console.warn("  !!!! [WARNING] " + file_path + " not found with search recursively.");
				depend.is_exist = false;
				return;
			}
			absolute_path = flatten_search[0];
			console.log(flatten_search[0]);
		} else {
			depend.is_exist = false;
			return;
		}
	}
	const data = fs.readFileSync(absolute_path, "utf8");
	(data.match(re) || []).map((str) => {
		str.match(re);
		const matched = RegExp.$1;
		const result = {
			path: str.replace(re, matched),
			is_absolute: str.indexOf("<") != -1,
			is_searched: false,
			original_fragment: str
		};
		if(!result.is_absolute) {
			result.dir = path.dirname(file_path);
		}
		return result;
	}).forEach((result) => {
		console.log('  ' + result.original_fragment);
		if((!context.depends.find((elem) => {
			return elem.path == result.path
				&& elem.is_absolute == result.is_absolute
				&& elem.dir == result.dir;
		}))) {
			context.depends.push(result);
		}
	});
	depend.is_exist = true;
}

for(const file_path of context.args) {
	const result = {
		path: file_path,
		is_absolute: true,
		is_searched: false
	};
	analyse(result);
	context.depends.push(result);
}

for(let i = 0; i < context.depends.length; i++) {
	const depend = context.depends[i];
	if(depend.is_searched) continue;
	analyse(depend);
}

const copy_targets = context.depends
	.filter((elem) => { return elem.is_exist; })
	.map((elem) => { return elem.is_absolute ? elem.path : path.join(elem.dir, elem.path); });
const not_found_targets = context.depends
	.filter((elem) => { return !elem.is_exist; })
	.map((elem) => { return elem.is_absolute ? elem.path : path.join(elem.dir, elem.path); });

if(context.save_list) {
	fs.writeFileSync(
		context.save_list,
		JSON.stringify(
			copy_targets,
			null,
			"  "
		), "utf8");
}

if(context.doCopy) {
	if(context.doCopy && !fs.existsSync(context.dest)) {
		fs.mkdirsSync(context.dest);
	}
	for(const file_path of copy_targets) {
		fs.copySync(path.join(context.root, file_path), path.join(context.dest, file_path));
	}
}

console.log("copied:");
copy_targets.forEach((file_path) => { console.log("  " + file_path); });

console.warn("[WARN] not found:");
not_found_targets.forEach((file_path) => { console.warn("  " + file_path)});