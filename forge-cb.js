//
// Copyright (c) 2016 Autodesk, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// by Cyrille Fauvel
// Autodesk Forge Partner Development)
// July 2016
//
var ForgeOAuth =require('forge-oauth2') ;
var ForgeOSS =require ('forge-oss') ;
var ForgeDataManagement =require ('forge-data-management') ;
var ForgeModelDerivative =require ('forge-model-derivative') ;

var program =require ('commander') ;
var moment =require ('moment') ;
var async =require ('async') ;
var ejs =require ('ejs') ;
var opn =require ('opn') ;

var fs =require ('fs') ;
var url =require ('url') ;
var path =require ('path') ;

var clientId =process.env.FORGE_CLIENT_ID || 'your_client_id' ;
var clientSecret =process.env.FORGE_CLIENT_SECRET || 'your_client_secret' ;
var PORT =process.env.PORT || '3006' ;
var mycallback =process.env.FORGE_CALLBACK || ('http://localhost:' + PORT + '/oauth') ;

var grantType ='client_credentials' ; // {String} Must be ``client_credentials``
var opts ={ 'scope': 'data:read data:write data:create data:search bucket:create bucket:read bucket:update bucket:delete' } ;
var optsViewer ={ 'scope': 'data:read' } ;

var ossBuckets =new ForgeOSS.BucketsApi () ;
var ossObjects =new ForgeOSS.ObjectsApi () ;
//var dmHubs =new ForgeDataManagement.HubsApi () ;
//var dmFolders =new ForgeDataManagement.FoldersApi () ;
//var dmItems =new ForgeDataManagement.ItemsApi () ;
//var dmProjects =new ForgeDataManagement.ProjectsApi () ;
//var dmVersionss =new ForgeDataManagement.VersionsApi () ;
var md =new ForgeModelDerivative.DerivativesApi () ;

program
	.command ('2legged')
	.description ('get an application access token (2 legged)')
	.action (function (options) {
		oauthExec () ;
	}) ;
program
    .command ('3legged')
    .description ('get an user access token (3 legged)')
    .arguments ('[code]')
    .action (function (code, options) {
        var oa3Legged =new ForgeOAuth.ThreeLeggedApi () ;
        if ( !code || code === '' ) {
            var opts ={
                'scope': "data:read",
                'client_id': clientId,
                'response_type': 'code',
                'redirect_uri': mycallback
            } ;
            var st =Object.keys (opts).map (function (value, key) {
                return (value + '=' + encodeURIComponent (opts [value])) ;
            }) ;
            st =st.join ('&') ;
            opn (
				ForgeOAuth.ApiClient.instance.basePath + '/authentication/v1/authorize' + '?' + st//,
				/*{ app: [
					'google chrome',
					'--incognito'
				] }*/
			) ;
            console.log('Wait for the browser to return a code and run this script again with the code as parameter...') ;
            return ;
        } else {
            oa3Legged.gettoken (clientId, clientSecret, 'authorization_code', code, mycallback, function (error, data, response) {
                if ( errorHandler (error, data, 'Failed to get your token', false) )
                    return (fs.unlink (__dirname + '/data/access_token')) ;
                if ( httpErrorHandler (response, 'Failed to get your token', false) )
                    return (fs.unlink (__dirname + '/data/access_token')) ;

                var token =data.token_type + ' ' + data.access_token ;
                console.log ('Your new 3-legged access token is: ' + token) ;
                var dt =moment ().add (data.expires_in, 'seconds') ;
                console.log ('Expires at: ' + dt.format ('MM/DD/YYYY, hh:mm:ss a')) ;
                fs.writeFile (__dirname + '/data/access_token', token, function (err) {
                    if ( err )
                        return (console.error ('Failed to create access_token file')) ;
                }) ;
                token =data.token_type + ' ' + data.refresh_token ;
                fs.writeFile (__dirname + '/data/refresh_token', token, function (err) {
                    if ( err )
                        return (console.error ('Failed to create refresh_token file')) ;
                }) ;
            }) ;
        }
    }) ;
program
    .command ('3legged aboutme information')
    .description ('3legged aboutme')
    .action (function (options) {
        console.log ('About Me!...') ;
        access_token (function (access_token) {
            ForgeOAuth.ApiClient.instance.authentications ['oauth2_access_code'].accessToken =access_token ;
            var oa3Info =new ForgeOAuth.InformationalApi () ;
            oa3Info.aboutMe (function (error, data, response) {
                console.log (JSON.stringify (data, null, 4)) ;
            }) ;
        }) ;
    }) ;
program
	.command ('buckets')
	.description ('list local/server buckets')
	.option ('-s, --server')
	.option ('-a, --startAt <startAt>', 'startAt: where to start in the list [string, default: none]')
	.option ('-l, --limit <limit>', 'limit: how many to return [integer, default: 10]')
	.option ('-r, --region <region>', 'region: US or EMEA [string, default: US]')
	.action (function (options) {
		if ( options && options.hasOwnProperty ('server') ) {
			var limit =options.limit || 10 ;
			var startAt =options.startAt || null ;
			var region =options.region || 'US' ;
			var opts ={ 'limit': limit, 'startAt': startAt, 'region': region } ;
			console.log ('Listing from ' + startAt + ' to ' + limit) ;
			access_token (function (/*access_token*/) {
                ossBuckets.getBuckets (opts, function (error, data, response) {
					errorHandler (error, data, 'Failed to access buckets list') ;
                    httpErrorHandler (response, 'Failed to access buckets list') ;
					//console.log (prettyjson.render (data, {})) ;
					console.log (JSON.stringify (data, null, 4)) ;
					if ( !data.hasOwnProperty ('next') || !data.next ) {
						console.log ('Your search is complete, no more items to list') ;
					} else {
						var url_parts =url.parse (data.next, true) ;
						var startAt =url_parts.query.startAt ;
						console.log ('Your next search startAt is: ' + startAt) ;
					}
				}) ;
			}) ;
		} else {
			fs.readdir (__dirname + '/data', function (err, files) {
				if ( err )
					return ;
				var files =filterBucket (files, '(.*)\.bucket\.json') ;
				console.log (JSON.stringify (files, null, 4)) ;
			}) ;
		}
	}) ;
program
	.command ('bucket')
	.description ('set or get the current bucket')
	.arguments ('[bucketKey]')
	.action (function (bucketKey, options) {
		if ( bucketKey && bucketKey !== '' ) {
			if ( !checkBucketKey (bucketKey) )
				return ;
			fs.writeFile (__dirname + '/data/bucket', bucketKey, function (err) {
				if ( err )
					return (console.error ('Failed to create bucket file')) ;
			}) ;
		} else {
			fs.readFile (__dirname + '/data/bucket', 'utf-8', function (err, data) {
				if ( err )
					return ;
				console.log ('Current bucket is: ' + data) ;
			}) ;
		}
	}) ;
program
	.command ('bucketCreate')
	.description ('create a new bucket,; default Type is transient, values can be transient/temporary/permanent')
	.arguments ('<bucketKey> [type]')
	.option ('-r, --region <region>', 'region: US or EMEA [string, default: US]')
	.action (function (bucketKey, type, options) {
		if ( !checkBucketKey (bucketKey) )
			return ;
		type =type || 'transient' ;
		var region =options.region || 'US' ;
		console.log ('Create bucket: ' + bucketKey) ;
		access_token (function (/*access_token*/) {
			var opts ={
				"bucketKey": bucketKey,
				"policyKey": type
			} ;
			var headers ={
				'xAdsRegion': region
			} ;
			ossBuckets.createBucket (opts, headers, function (error, data, response) {
				errorHandler (error, data, 'Failed to create bucket') ;
				httpErrorHandler (response, 'Failed to create bucket') ;
				fs.writeFile (__dirname + '/data/bucket', bucketKey, function (err) {
					if ( err )
						return (console.error ('Failed to create bucket file')) ;
				}) ;
				fs.writeFile (__dirname + '/data/' + bucketKey + '.bucket.json', JSON.stringify (data, null, 4), function (err) {
					if ( err )
						return (console.error ('Failed to create ' + bucketKey + '.bucket.json file')) ;
				}) ;
				console.log ('bucket created') ;
			}) ;
		}) ;
	}) ;
program
	.command ('bucketCheck')
	.description ('check bucket validity, outputs the expiration; date/time for this bucket; if no parameter use the current bucket')
	.arguments ('[bucketKey]')
	.action (function (bucketKey) {
		bucketKey =bucketKey || readBucketKey () ;
		if ( !checkBucketKey (bucketKey, options) )
			return ;
		console.log ('Getting bucket details') ;
		access_token (function (/*access_token*/) {
            ossBuckets.getBucketDetails (bucketKey, function (error, data, response) {
				errorHandler (error, data, 'Failed to access bucket details') ;
                httpErrorHandler (response, 'Failed to access bucket details') ;
                if ( data.policyKey === 'transient' ) // 24 hours
					console.log ('bucket content will expire after: 24 hours') ;
				else if ( data.policyKey === 'temporary' ) // 30 days
					console.log ('bucket content will expire after: 30 days') ;
				else // persistent
					console.log ('bucket content will never expire') ;
			}) ;
		}) ;
	}) ;
program
	.command ('bucketItems')
	.description ('list items in a given bucket; required to be in the API white list to use this API; if no parameter use the current bucket')
	.arguments('[bucketKey]')
	.option ('-a, --startAt <startAt>', 'startAt: where to start in the list [string, default: none]')
	.option ('-l, --limit <limit>', 'limit: how many to return [integer, default: 10]')
	.option ('-r, --region <region>', 'region: US or EMEA [string, default: US]')
	.action (function (bucketKey, options) {
		bucketKey =bucketKey || readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		console.log ('Listing bucket ' + bucketKey + ' content') ;
		access_token (function (/*access_token*/) {
			var limit =options.limit || 10 ;
			var startAt =options.startAt || null ;
			var region =options.region || 'US' ;
			var opts ={ 'limit': limit, 'startAt': startAt, 'region': region } ;
            ossObjects.getObjects (bucketKey, opts, function (error, data, response) {
				errorHandler (error, data, 'Failed to access buckets list') ;
                httpErrorHandler (response, 'Failed to access buckets list') ;
                console.log (JSON.stringify (data, null, 4)) ;
				if ( !data.hasOwnProperty ('next') ) {
					console.log ('Your search is complete, no more items to list') ;
				} else {
					var url_parts =url.parse (data.next, true) ;
					var startAt =url_parts.query.startAt ;
					console.log ('Your next search index is: ' + startAt) ;
				}
			}) ;
		}) ;
	}) ;
program
	.command ('bucketDelete')
	.description ('delete a given bucket; if no parameter delete the current bucket')
	.arguments ('[bucketKey]')
	.action (function (bucketKey, options) {
		bucketKey =bucketKey || readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		console.log ('Delete bucket: ' + bucketKey) ;
		access_token (function (/*access_token*/) {
            ossBuckets.deleteBucket (bucketKey, function (error, data, response) {
				errorHandler (error, data, 'Failed to delete bucket', false) ;
                httpErrorHandler (response, 'Failed to delete bucket', false) ;
                fs.unlink (__dirname + '/data/bucket') ;
				fs.unlink (__dirname + '/data/' + bucketKey + '.bucket.json') ;
				console.log ('bucket deleted') ;
			}) ;
		}) ;
	}) ;
program
	.command ('upload')
	.description ('upload a file in the current bucket')
	.arguments ('<file>')
	.action (function (file, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		var fileKey =makeKey (file) ;
		fs.stat (file, function (err, stats) {
			if ( err )
				return (console.log (err.message)) ;
			var size =stats.size ;
			console.log ('Uploading file: ' + file) ;
			access_token (function (/*access_token*/) {
				var readStream =fs.createReadStream (file) ;
				ossObjects.uploadObject (bucketKey, fileKey, size, readStream, {}, function (error, data, response) {
					errorHandler (error, data, 'Failed to upload file') ;
					httpErrorHandler (response, 'Failed to upload file') ;
					fs.writeFile (__dirname + '/data/' + bucketKey + '.' + fileKey + '.json', JSON.stringify (data, null, 4), function (err) {
						if ( err )
							return (console.error ('Failed to create ' + bucketKey + '.' + fileKey + '.json file')) ;
					}) ;
					console.log ('Upload successful') ;
					console.log ('ID: ' + data.objectId) ;
					console.log ('URN: ' + new Buffer (data.objectId).toString ('base64')) ;
					console.log ('Location: ' + data.location) ;
				}) ;
			}) ;
		}) ;
	}) ;
program
	.command ('resumable')
	.description ('upload a file in multiple pieces (i.e. resumables)')
	.arguments ('<file> <pieces>')
	.action (function (file, pieces, options) {
		var bucketKey =readBucketKey () ;
		pieces =pieces || 2 ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		var fileKey =makeKey (file) ;
		fs.stat (file, function (err, stats) {
			if ( err )
				return (console.log (error.message)) ;
			var size =stats.size ;
			var pieceSz =parseInt (size / pieces) ;
			var modSz=size % pieces ;
			if ( modSz )
				pieces++ ;
			console.log ('Uploading file: ' + file + ' in ' + pieces + ' pieces') ;
			var piecesMap =Array.apply (null, { length: pieces }).map (Number.call, Number) ;
			var sessionId =Math.random ().toString (36).replace (/[^a-z]+/g, '').substr (0, 12) ;
			async.eachLimit (piecesMap, 1,
				function (i, callback) {
					var start =i * pieceSz ;
					var end =Math.min (size, (i + 1) * pieceSz) - 1 ;
					var range ="bytes " + start + "-" + end + "/" + size ;
					var length =end - start + 1 ;
					console.log ('Loading ' + range) ;
					// For resumable (large files), make sure to renew the token first
					//access_token (function (/*access_token*/) {
					oauthExec (function (accessToken) {
						var readStream =fs.createReadStream (file, { 'start': start, 'end': end }) ;
						ossObjects.uploadChunk (bucketKey, fileKey, length, range, sessionId, readStream, {}, function (error, data, response) {
							if ( errorHandler (error, data, 'Failed to upload partial file', false) )
								return (callback (error)) ;
							if ( response.statusCode !== 202 && httpErrorHandler (response, 'Failed to upload partial file', false) )
								return (callback (response.statusCode)) ;
							callback () ;
							if ( response.statusCode === 202 )
								return (console.log ('Partial upload accepted')) ;
							fs.writeFile (__dirname + '/data/' + bucketKey + '.' + fileKey + '.json', JSON.stringify (data, null, 4), function (err) {
								if ( err )
									return (console.error ('Failed to create ' + bucketKey + '.' + fileKey + '.json file')) ;
							}) ;
							console.log ('Upload successful') ;
							console.log ('ID: ' + data.objectId) ;
							console.log ('URN: ' + new Buffer (data.objectId).toString ('base64')) ;
							console.log ('Location: ' + data.location) ;
						}) ;
					}) ;
				},
				function (err) {
					if ( err )
						return (console.error ('Failed to upload file')) ;
				}
			) ;
		}) ;
	}) ;
program
	.command ('download')
	.description ('download the file from OSS')
	.arguments ('<fileKey> <outputFile>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, outputFile, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Downloading file: ' + fileKey) ;
		access_token (function (/*access_token*/) {
			var wstream =fs.createWriteStream (outputFile) ;
            ossObjects.getObject (
				bucketKey, fileKey,
				{ /*'acceptEncoding': 'text/plain'*/ },
				function (error, data, response) {
					errorHandler (error, data, 'Failed to download file') ;
                    httpErrorHandler (response, 'Failed to download file') ;
                    console.log ('Download successful') ;
                })
				.pipe (wstream) ;
		}) ;
	}) ;
program
	.command ('objectDetails')
	.description ('file information')
	.arguments ('<fileKey>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Getting details for file: ' + fileKey) ;
		access_token (function (/*access_token*/) {
            ossObjects.getObjectDetails (bucketKey, fileKey, {}, function (error, data, response) {
				errorHandler (error, data, 'Failed to download file') ;
                httpErrorHandler (response, 'Failed to download file') ;
                console.log (JSON.stringify (data, null, 4)) ;
				fs.writeFile (__dirname + '/data/' + bucketKey + '.' + fileKey + '.json', JSON.stringify (data, null, 4), function (err) {
					if ( err )
						return (console.error ('Failed to create ' + bucketKey + '.' + file + '.json file')) ;
				}) ;
			}) ;
		}) ;
	}) ;
program
	.command ('translate')
	.description ('translate the file for viewing')
	.arguments ('<fileKey>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.option ('-e, --entry <rootFile>', 'rootFile: which file to start from')
	.action (function (fileKey, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Request file to be translated') ;
		var urn =URN (bucketKey, fileKey) ;
		options.entry =options.entry || fileKey ;
		access_token (function (/*access_token*/) {
			var job ={
				"input": {
					"urn": urn,
					"compressedUrn": (path.extname (fileKey).toLowerCase () === '.zip'),
					"rootFilename": options.entry
				},
				"output": {
					"formats": [
						{
							"type": "svf",
							"views": [
								"2d",
								"3d"
							]
						}
					]
				}
			} ;
			//var jobObj =new ForgeModelDerivativeApi.JobPayload () ;
			//jobObj =ForgeModelDerivativeApi.JobPayload.constructFromObject (job, jobObj) ;
			var bForce =true ;
			md.translate (job, { 'xAdsForce': bForce }, function (error, data, response) {
				errorHandler (error, data, 'Failed to register file for translation') ;
                httpErrorHandler (response, 'Failed to register file for translation') ;
                console.log ('Registration successfully submitted.') ;
				console.log (JSON.stringify (data, null, 4)) ;
			}) ;
		}) ;
	}) ;
program
	.command ('translateProgress')
	.description ('file translation progress')
	.arguments ('<fileKey>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Checking file translation progress') ;
		var urn =URN (bucketKey, fileKey) ;
		access_token (function (/*access_token*/) {
			md.getManifest (urn, {}, function (error, data, response) {
				errorHandler (error, data, 'Failed to get file manifest') ;
                httpErrorHandler (response, 'Failed to get file manifest') ;
				console.log ('Request: ' + data.status + ' (' + data.progress + ')') ;
			}) ;
		}) ;
	}) ;
program
	.command ('manifest')
	.description ('file manifest')
	.arguments ('<fileKey>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Getting file manifest') ;
		var urn =URN (bucketKey, fileKey) ;
		access_token (function (/*access_token*/) {
			md.getManifest (urn, {}, function (error, data, response) {
				errorHandler (error, data, 'Failed to get file manifest') ;
                httpErrorHandler (response, 'Failed to get file manifest') ;
                console.log (JSON.stringify (data, null, 4)) ;
			}) ;
		}) ;
	}) ;
program
	.command ('metadata')
	.description ('file metadata')
	.arguments ('<fileKey>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Getting file manifest') ;
		var urn =URN (bucketKey, fileKey) ;
		access_token (function (/*access_token*/) {
			md.getMetadata (urn, {}, function (error, data, response) {
				errorHandler (error, data, 'Failed to get file manifest') ;
                httpErrorHandler (response, 'Failed to get file manifest') ;
                console.log (JSON.stringify (data, null, 4)) ;
			}) ;
		}) ;
	}) ;
program
	.command ('thumbnail')
	.description ('get thumbnail')
	.arguments ('<fileKey> <outputFile>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, outputFile, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Getting file thumbnail') ;
		var urn =URN (bucketKey, fileKey) ;
		access_token (function (/*access_token*/) {
			var wstream =fs.createWriteStream (outputFile) ;
			md.getThumbnail (
				urn.replace (/=/gi, ''),
				{ width: 400, height: 400 }, // width: 400, height: 400
				function (error, data, response) {
					errorHandler (error, data, 'Failed to get file thumbnail') ;
                    httpErrorHandler (response, 'Failed to get file thumbnail') ;
                    console.log ('Thumbnail downloaded successfully') ;
                })
				.pipe (wstream) ;
		}) ;
	}) ;
program
	.command ('deleteFile')
	.description ('delete the source file from the bucket')
	.arguments ('<fileKey>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Deleting file ' + fileKey) ;
		access_token (function (/*access_token*/) {
            ossObjects.deleteObject (bucketKey, fileKey, function (error, data, response) {
				errorHandler (error, data, 'Failed to delete file') ;
                httpErrorHandler (response, 'Failed to delete file') ;
                console.log ('File deleted') ;
			}) ;
		}) ;
	}) ;
program
	.command ('deleteManifest')
	.description ('delete the manifest and all its translated output files (derivatives)')
	.arguments ('<fileKey>')
	.action (function (fileKey, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Deleting manifest for ' + fileKey) ;
		var urn =URN (bucketKey, fileKey) ;
		access_token (function (/*access_token*/) {
			md.deleteManifest (urn, function (error, data, response) {
				errorHandler (error, data, 'Failed to delete manifest') ;
                httpErrorHandler (response, 'Failed to delete manifest') ;
                console.log ('Manifest deleted') ;
			}) ;
		}) ;
	}) ;
program
	.command ('html')
	.description ('generate default html page')
	.arguments ('<fileKey> <outputFile>')
	.option ('-f, --file', 'fileKey represent the final objectKey on OSS vs a local fileKey')
	.action (function (fileKey, outputFile, options) {
		var bucketKey =readBucketKey () ;
		if ( !checkBucketKey (bucketKey) )
			return ;
		if ( options.file === undefined )
			fileKey =readFileKey (bucketKey, fileKey) ;
		console.log ('Creating file: ' + outputFile) ;
		var urn =URN (bucketKey, fileKey) ;
        oauthExecForRead (function (access_token) {
			var data ={ 'urn': urn, 'access_token': access_token } ;
			ejs.renderFile (__dirname + '/views/index.ejs', data, {}, function (err, str) {
				fs.writeFile (outputFile, str, function (err) {
					if ( err )
						return (console.error ('Failed to create file ' + outputFile)) ;
					console.log ('File created') ;
				}) ;
			}) ;
		}) ;
	}) ;

program
	.version ('2.0.0')
	//.option ('-u, --usage', 'Usage')
	.on ('--help', usage)
	.parse (process.argv) ;

//console.log ('Press any key to exit') ;
//process.stdin.setRawMode (true) ;
//process.stdin.resume () ;
//process.stdin.on ('data', process.exit.bind (process, 0)) ;
return ; // End of script

function usage() {
	console.log (" \
  forge-cb command [arg] \n\
    2legged \n\
        - get an application access token (2 legged) \n\
    3legged [code] \n\
        - get an user access token (3 legged) \n\
    aboutme \n\
        - 3legged aboutme information \n\
    buckets [-s [-a <startAt>] [-l <limit>] [-r <region>]] \n\
        - list local buckets \n\
          -s / --server : list buckets on the server \n\
          -a / --startAt <startAt> : where to start in the list [string, default: none] \n\
		  -l / --limit <limit> : how many to return [integer, default: 10] \n\
		  -r / --region <region> : US or EMEA [string, default: US] \n\
    bucket [<Name>] \n\
        - set or get the current bucket \n\
    bucketCreate <Name> [<Type>] \n\
        - create a new bucket, \n\
          default Type is transient, values can be \n\
          transient/temporary/permanent \n\
    bucketCheck [<Name>] \n\
        - check bucket validity, outputs the expiration \n\
          date/time for this bucket \n\
          if no parameter use the current bucket \n\
    bucketItems [<Name>] [-a <startAt>] [-l <limit>] [-r <region>] \n\
        - list items in a given bucket \n\
          if no parameter use the current bucket \n\
          -a / --startAt <startAt> : where to start in the list [string, default: none] \n\
		  -l / --limit <limit> : how many to return [integer, default: 10] \n\
		  -r / --region <region> : US or EMEA [string, default: US] \n\
    bucketDelete [<Name>] \n\
        - delete a given bucket \n\
          if no parameter delete the current bucket \n\
    upload <File> \n\
        - upload a file in the current bucket \n\
    resumable <File> <Pieces> \n\
        - upload a file in multiple pieces (i.e. resumables) \n\
    download <FileKey> <OutputFile> \n\
        - download the file from OSS \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    objectDetails <FileKey> \n\
        - file information \n\
           -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    translate <FileKey> \n\
        - translate the file for viewing \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
          -e / --entry <rootFile> : which file to start from \n\
    translateProgress <FileKey> \n\
        - file translation progress \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    manifest <FileKey> \n\
        - urn manifest \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    metadata <FileKey> \n\
        - urn metadata \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    thumbnail <FileKey> \n\
        - get thumbnail \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    deleteManifest <FileKey> \n\
        - delete the manifest and all its translated output files (derivatives). \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    deleteFile <FileKey> \n\
        - delete the source file from the bucket \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
    html <FileKey> <OutputFile> \n\
        - generate default html page \n\
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey \n\
	") ;
}

function oauthExecForRead (cb) {
    //var oa3Legged =new ForgeOAuth.ThreeLeggedApi () ;
    var oa2Legged =new ForgeOAuth.TwoLeggedApi () ;
    //var oaInfo =new ForgeOAuth.InformationalApi () ;
    oa2Legged.authenticate (clientId, clientSecret, grantType, optsViewer, function (error, data, response) {
        errorHandler (error, data, 'Failed to get your viewer token') ;
        httpErrorHandler (response, 'Failed to get your viewer token') ;
        var token =data.token_type + ' ' + data.access_token ;
        console.log ('Your viewer 2-legged access token is: ' + token) ;
        var dt =moment ().add (data.expires_in, 'seconds') ;
        console.log ('Expires at: ' + dt.format ('MM/DD/YYYY, hh:mm:ss a')) ;

        if ( cb )
            cb (data.access_token) ;
    }) ;
}

function oauthExec (cb) {
	//var oa3Legged =new ForgeOAuth.ThreeLeggedApi () ;
    var oa2Legged =new ForgeOAuth.TwoLeggedApi () ;
    //var oaInfo =new ForgeOAuth.InformationalApi () ;
    oa2Legged.authenticate (clientId, clientSecret, grantType, opts, function (error, data, response) {
		if ( errorHandler (error, data, 'Failed to get your token', false) )
			return (fs.unlink (__dirname + '/data/access_token')) ;
        if ( httpErrorHandler (response, 'Failed to get your token', false) )
            return (fs.unlink (__dirname + '/data/access_token')) ;
        var token =data.token_type + ' ' + data.access_token ;
		console.log ('Your new 2-legged access token is: ' + token) ;
		var dt =moment ().add (data.expires_in, 'seconds') ;
		console.log ('Expires at: ' + dt.format ('MM/DD/YYYY, hh:mm:ss a')) ;
		fs.writeFile (__dirname + '/data/access_token', token, function (err) {
			if ( err )
				return (console.error ('Failed to create access_token file')) ;
		}) ;
		api_access_token (data.access_token, cb) ;
	}) ;
}

function access_token (cb) {
	fs.readFile (__dirname + '/data/access_token', 'utf-8', function (err, data) {
		if ( err )
			return ;
		var accessToken =data.split (' ') [1] ;
		api_access_token (accessToken, cb) ;
	}) ;
}

function api_access_token (accessToken, cb) {
	//ForgeOSS.ApiClient.instance.authentications ['oauth2_access_code'].accessToken =accessToken ;
	ForgeOSS.ApiClient.instance.authentications ['oauth2_application'].accessToken =accessToken ;

	//ForgeDataManagementApi.ApiClient.instance.authentications ['oauth2_access_code'].accessToassToken ;
	ForgeDataManagement.ApiClient.instance.authentications ['oauth2_application'].accessToken =accessToken ;

	//ForgeModelDerivativeApi.ApiClient.instance.authentications ['oauth2_access_code'].accessToken =accessToken ;
	ForgeModelDerivative.ApiClient.instance.authentications ['oauth2_application'].accessToken =accessToken ;

	if ( cb )
		cb (accessToken) ;
}

function errorHandler (error, data, msg, bExit) {
	bExit =bExit == undefined ? true : bExit ;
	msg =msg || '' ;
    if ( error && error.code ) {
        console.error (msg) ;
        console.error (error.code) ;
        if ( bExit )
            process.exit (1) ;
        return (true) ;
    }
    if ( error && error.status && error.message ) {
		console.error (msg) ;
		console.error (error.status + ': ' + error.message) ;
		if ( error.response && error.response.text ) {
			try {
				var reason =JSON.parse (error.response.text) ;
				console.error (reason.reason) ;
			} catch ( e ) {
				console.error (error.response.text) ;
			}
		}
		if ( bExit )
			process.exit (1) ;
		return (true) ;
	}
	if ( data && data.hasOwnProperty ('errorCode') ) {
		console.error (msg) ;
		console.error (data.errorCode + ' - ' + data.developerMessage) ;
		if ( data.errorCode == 'AUTH-006' )
			console.log ('You need to be added to the White List to use this API - please contact us to be added') ;
		if ( bExit )
			process.exit (2) ;
		return (true) ;
	}
	return (false) ;
}

function httpErrorHandler (response, msg, bExit) {
    bExit =bExit == undefined ? true : bExit ;
    msg =msg || '' ;
    if ( response.statusCode !== 200 ) {
        console.error (msg) ;
        console.error ('HTTP ' + response.statusCode + ' ' + response.statusMessage) ;
        if ( response.body )
            console.error (response.body) ;
        if ( bExit )
            process.exit (1) ;
        return (true) ;
    }
    return (false) ;
}

function filterBucket (arr, criteria) {
	var filtered =arr.filter (function (obj) { return (new RegExp (criteria).test (obj)) ; }) ;
	var results =[] ;
	for ( var index =0 ; index < filtered.length ; index++ )
		results.push (new RegExp (criteria).exec (filtered [index]) [1]) ;
	return (results) ;
}

function readBucketKey () {
    try {
        return (fs.readFileSync (__dirname + '/data/bucket', 'utf-8')) ;
    } catch ( e ) {
        console.error ('bucket file not found!') ;
    }
    return (false) ;
}

function checkBucketKey (name) {
	var p = /^[-_.a-z0-9]{3,128}$/ ;
	var result =p.test (name) ;
	if ( !result )
		console.error ('Invalid bucket name') ;
	return (result) ;
}

function makeKey (file) {
	var filename =path.basename (file) ;
	return (filename) ;
}

function readFileKey (bucketKey, fileKey) {
	try {
		var details =fs.readFileSync (__dirname + '/data/' + bucketKey + '.' + fileKey + '.json', 'utf-8') ;
		details =JSON.parse (details) ;
		return (details.objectKey) ;
	} catch ( e ) {
	}
	return (fileKey) ;
}

function URN (bucketKey, fileKey) {
	var urn ='urn:adsk.objects:os.object:' + bucketKey + '/' + fileKey ;
	try {
		var details =fs.readFileSync (__dirname + '/data/' + bucketKey + '.' + fileKey + '.json', 'utf-8') ;
		details =JSON.parse (details) ;
		urn =details.objectId ;
		//fileKey =details.objectKey ;
	} catch ( e ) {
	}
	urn =new Buffer (urn).toString ('base64') ;
	return (urn) ;
}

function getQueryString (field, url) {
	var href =url ? url : window.location.href ;
	var reg =new RegExp( '[?&]' + field + '=([^&#]*)', 'i' ) ;
	var st =reg.exec(href);
	return (st ? st [1] : null) ;
}
