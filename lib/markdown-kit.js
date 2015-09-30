/*
	The Cedric's Swiss Knife (CSK) - CSK markdown toolbox

	Copyright (c) 2015 Cédric Ronvel 
	
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



// Load modules
var async = require( 'async-kit' ) ;
var marked = require( 'marked' ) ;
var highlight = require( 'highlight.js' ) ;
var minimist = require( 'minimist' ) ;

var fs = require( 'fs' ) ;





var cssDir = __dirname + '/../css/' ;



markdownKit = {} ;
module.exports = markdownKit ;



markdownKit.generateContents = function generateContents( markdownString )
{
	// Synchronous highlighting with highlight.js
	marked.setOptions( {
		gfm: true ,
		tables: true ,
		breaks: false ,
		highlight: function ( code , langage ) {
			
			if ( langage === 'no-highlight' || langage === 'nohl' ) { return code ; }
			return highlight.highlightAuto( code ).value ;
		}
	} ) ;
	
	return marked( markdownString ) ;
}



markdownKit.getFirstTagContents = function getFirstTagContents( html , tag )
{
	// Get the content of first "tag" tag, using a non-greedy RegExp (.*?)
	var matched = html.match( new RegExp( '<' + tag + '[^>]*>(.*?)</' + tag + '>' ) ) ;
	
	if ( ! matched ) { return 'Markdown 2 HTML converter' ; }
	
	var contents = matched[ 1 ] ;
	
	// remove tags in contents
	contents = contents.replace( /<[^>]+>/ig , '' ) ;
	
	// remove unclosed tags and other remaining garbage... < and > should be HTML entities to survive this
	contents = contents.replace( '<' , '' ).replace( '>' , '' ) ;
	
	return contents ;
}



markdownKit.generateStandAlone = function generateStandAlone( contents )
{
	var corpus = markdownKit.generateContents( contents.markdown ) ;
	var title = markdownKit.getFirstTagContents( corpus , 'h1' ) ;
	
	return '<!DOCTYPE html>\n' +
		'<html>\n<head>\n' +
		'<title>' + title + '</title>\n' +
		'<meta charset="UTF-8">\n' +
		'<style>\n' + contents.standAloneCss + '\n\n' + contents.markdownCss + '\n\n' + contents.hightlightCss + '\n</style>\n' +
		'</head>\n<body>\n' +
		'<div class="markdown">\n' +
		corpus + '\n' +
		'</div>\n' +
		'</body>\n</html>\n' ;
} ;



markdownKit.generateFragment = function generateFragment( contents )
{	
	var corpus = markdownKit.generateContents( contents.markdown ) ;
	
	return '<div class="markdown">\n' + 
		'<style scoped>\n' + contents.markdownCss + '\n\n' + contents.hightlightCss + '\n</style>\n' +
		corpus + '\n' +
		'</div>\n' ;
} ;



markdownKit.cli = function cli()
{
	var args = minimist( process.argv.slice( 2 ) ) ;
	
	// Make sure we got input_file on the command line.
	if ( process.argv.length < 3 ) {
		console.log( '\nUsage: node ' + process.argv[ 1 ] + ' input_file\n\n' ) ;
		process.exit( 1 ) ;
	}
	
	// Read the file and print its contents.
	var files = {
		markdown: args._[ 0 ] ,
		standAloneCss: cssDir + 'standalone-github-like.css' ,
		markdownCss: cssDir + 'markdown-github-like.css' ,
		hightlightCss: cssDir + 'highlight-github-like.css'
	} ;
	
	async.map( files , function( element , mapCallback ) {
		
		fs.readFile( element , 'utf8' , mapCallback ) ;
	} )
	.exec( function( error , contents ) {
		if ( error ) { throw error ; }
		process.stdout.write( markdownKit.generateStandAlone( contents ) ) ;
		//process.stdout.write( generateFragment( contents ) ) ;
	} ) ;
} ;



