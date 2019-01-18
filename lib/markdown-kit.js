/*
	Markdown2Html

	Copyright (c) 2015 - 2019 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



// Load modules
var hyperMarkdown = require( 'hyper-markdown' ) ;
var highlight = require( 'highlight.js' ) ;
var minimist = require( 'minimist' ) ;
//var string = require( 'string-kit' ) ;

var fs = require( 'fs' ) ;
var path = require( 'path' ) ;

var Promise = require( 'seventh' ) ;
Promise.promisifyNodeApi( fs ) ;



var cssDir = __dirname + '/../css/' ;

const BUILTIN_CSS = [
	cssDir + 'standalone.css' ,
	cssDir + 'markdown.css' ,
	cssDir + 'highlight.css'
] ;



var markdownKit = {} ;
module.exports = markdownKit ;



markdownKit.markdown2htmlCli = async function markdown2htmlCli() {
	var args , source , extension , files , cwd , package_ , baseDir ;

	cwd = process.cwd() + '/' ;
	args = minimist( process.argv.slice( 2 ) ) ;

	source = args._[ 0 ] ;

	// Make sure we got input_file on the command line.
	if ( ! source ) { markdownKit.markdown2htmlUsage() ; }

	extension = path.extname( source ).slice( 1 ) ;

	switch ( extension ) {
		case 'json' :
			if ( path.isAbsolute( source ) ) {
				baseDir = path.dirname( source ) + '/' ;
				package_ = require( source ) ;
			}
			else {
				baseDir = path.dirname( cwd + source ) + '/' ;
				package_ = require( cwd + source ) ;
			}
			break ;

		case 'md' :
			baseDir = cwd ;
			package_ = {
				sources: [ source ]
			} ;
			break ;

		default :
			markdownKit.markdown2htmlUsage() ;
	}

	// Read the file and print its contents.
	files = {
		markdown: package_.sources
	} ;

	if ( Array.isArray( package_.css ) ) {
		files.style = BUILTIN_CSS.concat( package_.styles ) ;
	}
	else {
		files.style = BUILTIN_CSS ;
	}

	if ( Array.isArray( package_.scripts ) ) {
		files.script = package_.scripts ;
	}
	else {
		files.script = [] ;
	}


	// Get contents
	var contents = {} ;

	await Promise.forEach( Object.keys( files ) , async( key ) => {
		var filePath = files[ key ] ;

		if ( Array.isArray( filePath ) ) {
			var content = '' ;

			await Promise.forEach( filePath , async( filePath_ ) => {

				if ( ! path.isAbsolute( filePath_ ) ) { filePath_ = baseDir + filePath_ ; }
				if ( ! path.extname( filePath_ ) ) { filePath_ += '.md' ; }

				content += '\n' + await fs.readFileAsync( filePath_ , 'utf8' ) ;
			} ) ;

			contents[ key ] = content ;
		}
		else {
			if ( ! path.isAbsolute( filePath ) ) { filePath = baseDir + filePath ; }
			if ( ! path.extname( filePath ) ) { filePath += '.md' ; }

			contents[ key ] = await fs.readFileAsync( filePath , 'utf8' ) ;
		}
	} ) ;

	if ( package_.cssLinks ) { contents.cssLinks = package_.cssLinks ; }
	if ( package_.scriptLinks ) { contents.scriptLinks = package_.scriptLinks ; }

	if ( args.pdf ) {
		await new Promise( ( resolve , reject ) => {
			var pdfStream = markdownKit.createPdfStream( contents ) ;
			pdfStream.pipe( fs.createWriteStream( 'test.pdf' ) ) ;
			pdfStream.on( 'error' , reject ) ;
			pdfStream.on( 'finish' , resolve ) ;
			pdfStream.end() ;
		} ) ;
	}
	else {
		process.stdout.write( markdownKit.generateStandAlone( contents ) ) ;
	}
} ;



markdownKit.markdown2htmlUsage = function markdown2htmlUsage() {
	console.error( '\nUsage: ' + process.argv[ 1 ] + ' <markdown-file.md>\n' ) ;
	console.error( '\nor: ' + process.argv[ 1 ] + ' <package.json>\n' ) ;
	process.exit( 1 ) ;
} ;



markdownKit.generateStandAlone = function generateStandAlone( data ) {
	var content = markdownKit.generateContents( data.markdown ) ;
	var title = data.title || markdownKit.getFirstTagContents( content , 'h1' ) || 'Untitled' ;
	var style = Array.isArray( data.style ) ? data.style.join( '\n\n' ) : data.style ;
	var cssLinks ;
	var script = Array.isArray( data.script ) ? data.script.join( '\n\n' ) : data.script ;
	var scriptLinks ;

	if ( data.cssLinks ) {
		cssLinks = Array.isArray( data.cssLinks ) ? data.cssLinks : [ data.cssLinks ] ;
		cssLinks = cssLinks.map( link => '<link rel="stylesheet" href="' + link + '"/>' ).join( '\n' ) ;
	}

	if ( data.scriptLinks ) {
		scriptLinks = Array.isArray( data.scriptLinks ) ? data.scriptLinks : [ data.scriptLinks ] ;
		scriptLinks = scriptLinks.map( link => '<script src="' + link + '"></script>' ).join( '\n' ) ;
	}

	var html = '<!DOCTYPE html>\n' ;
	html += '<html>\n<head>\n' ;

	html += '<title>' + title + '</title>\n' ;
	html += '<meta charset="UTF-8" />\n' ;

	if ( style ) { html += '<style>\n' + style + '\n</style>\n' ; }
	if ( cssLinks ) { html += cssLinks ; }

	if ( script ) { html += '<script>\n' + script + '\n</script>\n' ; }
	if ( scriptLinks ) { html += scriptLinks ; }

	html += '</head>\n<body>\n' ;

	html += '<div class="markdown">\n' ;
	html += content + '\n' ;
	html += '</div>\n' ;
	html += '</body>\n</html>\n' ;

	return html ;
} ;



markdownKit.generateFragment = function generateFragment( data ) {
	var content = markdownKit.generateContents( data.markdown ) ;
	var style = Array.isArray( data.style ) ? data.style.join[ '\n\n' ] : data.style ;

	var html = '<div class="markdown">\n' ;

	if ( style ) { html += '<style scoped>\n' + style + '\n</style>\n' ; }

	html += content + '\n' ;
	html += '</div>\n' ;

	return html ;
} ;



markdownKit.generateContents = function generateContents( markdownString ) {
	// Synchronous highlighting with highlight.js
	hyperMarkdown.setOptions( {
		highlight: function( code , langage ) {

			if ( langage === 'no-highlight' || langage === 'nohl' ) { return code ; }
			return highlight.highlightAuto( code ).value ;
		}
	} ) ;

	return hyperMarkdown( markdownString ) ;
} ;



markdownKit.getFirstTagContents = function getFirstTagContents( html , tag ) {
	// Get the content of first "tag" tag, using a non-greedy RegExp (.*?)
	var matched = html.match( new RegExp( '<' + tag + '[^>]*>(.*?)</' + tag + '>' ) ) ;

	if ( ! matched ) { return ; }

	var contents = matched[ 1 ] ;

	// remove tags in contents
	contents = contents.replace( /<[^>]+>/ig , '' ) ;

	// remove unclosed tags and other remaining garbage... < and > should be HTML entities to survive this
	contents = contents.replace( '<' , '' ).replace( '>' , '' ) ;

	return contents ;
} ;



/* PDF part */



markdownKit.createPdfStream = function createPdfStream( data ) {
	var hyperMarkdownPdf = require( 'hyper-markdown-pdf' ) ;
	var content = markdownKit.generateContents( data.markdown ) ;

	// Useful?
	/*
	var title = data.title || markdownKit.getFirstTagContents( content , 'h1' ) || 'Untitled' ;
	var style = Array.isArray( data.style ) ? data.style.join( '\n\n' ) : data.style ;
	*/

	var htmlDoc = hyperMarkdownPdf.parse( content ) ;

	return htmlDoc.createPdfStream() ;
} ;


