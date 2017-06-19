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
var asyncKit = require( 'async-kit' ) ;
var hyperMarkdown = require( 'hyper-markdown' ) ;
var highlight = require( 'highlight.js' ) ;
var minimist = require( 'minimist' ) ;
var string = require( 'string-kit' ) ;

var fs = require( 'fs' ) ;
var path = require( 'path' ) ;





var cssDir = __dirname + '/../css/' ;



markdownKit = {} ;
module.exports = markdownKit ;



markdownKit.generateContents = function generateContents( markdownString )
{
	/*
	var renderer = new hyperMarkdown.Renderer() ;
	
	renderer.image = ( href , title , text ) => {
		
		var html , float , figure = false ;
		
		text = text.replace( /^(?:(&lt;-)|(-&gt;))?(_)?/ , ( trash , floatLeft , floatRight , figure_ ) => {
			if ( floatLeft ) { float = 'left' ; }
			else if ( floatRight ) { float = 'right' ; }
			figure = !! figure_ ;
			return '' ;
		} ) ;
		
		if ( figure )
		{
			html = ( float ? '<figure class="float-' + float + '">' : '<figure>' ) ;
			html += '<img src="' + href + '" alt="' + text + '"' ;
			if ( title ) { html += ' title="' + title + '"' ; }
			html += '><figcaption>' + text + '</figcaption></figure>' ;
			
			// In marked, image are inline, this hack can fixe few things,
			// but it is still a hack, and should probably be fixed upstream
			html = '</p>' + html + '<p>' ;
		}
		else
		{
			html = '<img src="' + href + '" alt="' + text + '"' ;
			if ( float ) { html += ' class="float-' + float + '"' ; }
			if ( title ) { html += ' title="' + title + '"' ; }
			html += '>' ;
		}
		
		return html ;
	} ;
	//*/
	
	// Synchronous highlighting with highlight.js
	hyperMarkdown.setOptions( {
		highlight: function ( code , langage ) {
			
			if ( langage === 'no-highlight' || langage === 'nohl' ) { return code ; }
			return highlight.highlightAuto( code ).value ;
		}
	} ) ;
	
	return hyperMarkdown( markdownString ) ;
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



markdownKit.markdown2htmlCli = function markdown2htmlCli()
{
	var args , source , extension , files , cwd , package , baseDir ;
	
	cwd = process.cwd() + '/' ;
	args = minimist( process.argv.slice( 2 ) ) ;
	
	source = args._[ 0 ] ;
	
	// Make sure we got input_file on the command line.
	if ( ! source ) { markdownKit.markdown2htmlUsage() ; }
	
	extension = path.extname( source ).slice( 1 ) ;
	
	switch ( extension )
	{
		case 'json' :
			if ( path.isAbsolute( source ) )
			{
				baseDir = path.dirname( source ) + '/' ;
				package = require( source ) ;
			}
			else
			{
				baseDir = path.dirname( cwd + source ) + '/' ;
				package = require( cwd + source ) ;
			}
			break ;
			
		case 'md' :
			baseDir = cwd ;
			package = {
				sources: [ source ]
			} ;
			break ;
			
		default :
			markdownKit.markdown2htmlUsage() ;
	}
	
	// Read the file and print its contents.
	files = {
		markdown: package.sources ,
		standAloneCss: cssDir + 'standalone-github-like.css' ,
		markdownCss: cssDir + 'markdown-github-like.css' ,
		hightlightCss: cssDir + 'highlight-github-like.css'
	} ;
	
	asyncKit.map( files , function( filePath , mapCallback ) {
		
		var content , filePath ;
		
		if ( Array.isArray( filePath ) )
		{
			content = '' ;
			
			asyncKit.foreach( filePath , function( filePath , foreachCallback ) {
				
				if ( ! path.isAbsolute( filePath ) ) { filePath = baseDir + filePath ; }
				if ( ! path.extname( filePath ) ) { filePath += '.md' ; }
				
				fs.readFile( filePath , 'utf8' , function( error , content_ ) {
					if ( error ) { foreachCallback( error ) ; return ; }
					content += '\n' + content_ ;
					foreachCallback() ;
				} ) ;
			} )
			.exec( function( error ) {
				if ( error ) { mapCallback( error ) ; return ; }
				mapCallback( undefined , content ) ;
			} ) ;
		}
		else
		{
			if ( ! path.isAbsolute( filePath ) ) { filePath = baseDir + filePath ; }
			if ( ! path.extname( filePath ) ) { filePath += '.md' ; }
			
			fs.readFile( filePath , 'utf8' , mapCallback ) ;
		}
	} )
	.exec( function( error , contents ) {
		if ( error ) { throw error ; }
		process.stdout.write( markdownKit.generateStandAlone( contents ) ) ;
		//process.stdout.write( generateFragment( contents ) ) ;
	} ) ;
} ;



markdownKit.markdown2htmlUsage = function markdown2htmlUsage()
{
	console.error( '\nUsage: ' + process.argv[ 1 ] + ' <markdown-file.md>\n' ) ;
	console.error( '\nor: ' + process.argv[ 1 ] + ' <package.json>\n' ) ;
	process.exit( 1 ) ;
}

