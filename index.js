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
	.version('0.0.1')
	.usage('[options] <target ...>')
	.option('-c, --copy', 'copy')
	.option('-s, --save-list <file_name>', 'save dependency list.')
	.option('-r, --root <dir>', 'library root directory. [default: .]')
	.option('-d, --dest <dir>', 'copy destination directory. [default: ./dest]')
	.parse(process.argv);

const context = {
	args: program.args,
	doCopy: program.copy ? true : false,
	root: program.root || '.',
	dest: program.dest || './dest',
	save_list: program.saveList,
	depends: []
};

assert(fs.existsSync(context.root), 'root directory [' + context.root + '] is not exist.');

console.log(context.args);

assert(context.args.length != 0, 'argument is not given.');
for(let i = 0; i < context.args.length; i++) {
	assert(fs.existsSync(path.join(context.root, context.args[i])), 'argument at ' + i + ' [' + context.args[i] + '] is not exisit in ' + context.root + ".");
}

console.log('project root: ' + context.root);

function analyse(file_path) {
	console.log('anylyse ' + file_path);
	const absolute_path = path.join(context.root, file_path);
	if(!fs.existsSync(absolute_path)) {
		console.warn("  !!!! [WARNING] " + file_path + " not found.");
		return false;
	}
	const data = fs.readFileSync(absolute_path, "utf8");
	matched = data.match(re) || [];
	matched.map((str) => {
		return {
			path: str.replace(re, RegExp.$1),
			is_absolute: str.indexOf("<") != -1,
			is_searched: false
		};
	}).forEach((result) => {
		console.log('  ' + result.path);
		if((!context.depends.find((elem) => { return elem.path == result.path; }))) {
			context.depends.push(result);
		}
	});
	return true;
}

const re = new RegExp("");
re.compile(/#[ \t\r\n]*include[ \t\r\n]*<([^>]+)>|"(["]+)"/g);
for(file_path of context.args) {
	const result = {
		path: file_path,
		is_absolute: true,
		is_searched: true
	};
	result.is_exist = analyse(file_path);
	context.depends.push(result);
}

for(let i = 0; i < context.depends.length; i++) {
	context.depends[i].is_searched = true;
	context.depends[i].is_exist = analyse(context.depends[i].path);
}

const copy_targets = context.depends
	.filter((elem) => { return elem.is_exist; })
	.map((elem) => { return elem.path; });

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
	for(file_path of copy_targets) {
		fs.copySync(path.join(context.root, file_path), path.join(context.dest, file_path));
	}
}
