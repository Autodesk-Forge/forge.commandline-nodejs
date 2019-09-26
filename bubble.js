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
// Autodesk Forge Partner Development
//
/*jshint esversion: 6 */
/*jshint -W014 */

const ForgeAPI =require ('forge-apis') ;
const zip =require ('node-zip') ;
const archiver =require ('archiver') ;
const ejs =require ('ejs') ;
const mkdirp =require ('mkdirp') ;
const fs =require ('fs') ;
const zlib =require ('zlib') ;
const path =require ('path') ;
const utils =require ('./api/utils') ;

function svfBubble (progress) {
	this._outPath ='./' ;
	this._token =null ;
	this._progress =progress ;
	//this._filesToFetch =0 ;
	//this._estimatedSize =0 ;
	//this._progress =0 ;
	this._viewables =[] ; // { path: '', name: '' }
	this._errors =[] ; // ''

	this.downloadBubble =(urn, outPath, token) => {
		let self =this ;
		if ( token ) {
			self._token =new ForgeAPI.AuthClientTwoLegged ('__', '__', [ 'data:read' ]) ;
			self._token.setCredentials ({
				'token_type': 'Bearer',
				'expires_in': 1799,
				'access_token': token
			}) ;
		} else {
			self._token =forgeToken.RW ;
		}
		self._outPath =outPath ;
		return (new Promise ((fulfill, reject) => {
			self._progress.msg ='Downloading manifest' ;
			self.getManifest (urn)
				.then ((bubble) => {
					//utils.writeFile (outPath + 'bubble.json', bubble) ;
					self._progress.msg ='Listing all derivative files' ;
					self.listAllDerivativeFiles (bubble.body, (error, result) => {
						self._progress._filesToFetch =result.list.length ;
						console.log ('Number of files to fetch:', self._progress._filesToFetch) ;
						self._progress._estimatedSize =0 | (result.totalSize / (1024 * 1024)) ;
						console.log ('Estimated download size:', self._progress._estimatedSize, 'MB') ;

						//self.fixFlatBubbles (result) ;
						//self.fixFusionBubbles (result) ;

						self._progress.msg ='Downloading derivative files' ;
						self.downloadAllDerivativeFiles (result.list, self._outPath, (failed, succeeded) => {
							//if ( ++self._done == 1 /*2*/ )
							//	return ;
							self.failed =failed ;
							self.succeeded =succeeded ;
							fulfill (self) ;
						}) ;
					}) ;
				})
				.catch ((err) => {
					console.error ('Error:', err.message) ;
					self._errors.push (err.message) ;
					reject (self) ;
				})
			;
		})) ;
	} ;

	this.listAllDerivativeFiles =(bubble, callback) => {
		let self =this ;
		// First get all the root derivative files from the bubble
		let res =[] ;
		(function traverse (node, parent) {
			if (   node.role === 'Autodesk.CloudPlatform.PropertyDatabase'
				|| node.role === 'Autodesk.CloudPlatform.DesignDescription'
				|| node.role === 'Autodesk.CloudPlatform.IndexableContent'
				|| node.role === 'graphics'
				|| node.role === 'raas'
				|| node.role === 'pdf'
				|| node.role === 'leaflet-zip'
				|| node.role === 'preview'
				|| node.role === 'lod'
			) {
				let item ={ mime: node.mime } ;
				self.extractPathsFromGraphicsUrn (node.urn, item) ;
			//	if ( item.localPath === '' )
			//		item.localPath =parent.guid + '/' ;
				// Optionally replace the path in the source bubble by the local path
				// for use as local bubbles in the viewer
				node.urn ='$file$/' + item.localPath + item.rootFileName ;
				res.push (item) ;
				if (   node.mime == 'application/autodesk-svf'
					|| node.mime == 'application/autodesk-f2d'
				) {
					item.name =node.name =parent.name ;
					if ( parent.hasThumbnail === 'true' ) {
						let thumbnailItem ={ mime: 'thumbnail', urn: bubble.urn, guid: parent.guid,
							localPath: item.localPath,
							thumbnailUrn: '$file$/thumbnails/' + parent.guid + '.png',
							rootFileName: (item.rootFileName + '.png')
						} ;
						res.push (thumbnailItem) ;
					}
				}
			}
			if ( node.type === 'geometry' ) {
				// Why would we be sane and use real booleans??
				//if ( node.hasThumbnail === 'true' ) {
				//	let item ={ mime: 'thumbnail', urn: bubble.urn, guid: node.guid } ;
				//	if ( node.guid.substring (0, 1) === '{' ) {
				//		try {
				//			let guidObject =JSON.parse (node.guid) ;
				//			node.assetguid =guidObject.asset ;
				//			item.assetguid =guidObject.asset ;
				//		} catch ( ex ) {
				//		}
				//	}
				//	item.localPath ='/' ;
				//	node.thumbnailUrn ='$file$/thumbnails/' + item.guid + '.png' ;
				//	res.push (item) ;
				//}
				if ( node.intermediateFile && node.children ) {
					// We will derive the full intermediate file path from the child F2D node
					let f2dNode ;
					for ( let i =0 ; i<node.children.length ; i++) {
						if ( node.children [i].mime === 'application/autodesk-f2d' ) {
							f2dNode =node.children [i] ;
							break ;
						}
					}
					if ( f2dNode ) {
						let f2dUrl =f2dNode.urn ;
						let idx =f2dUrl.indexOf (bubble.urn) ;
						let baseUrl =f2dUrl.substr (0, idx + bubble.urn.length) ;
						let item ={ mime: 'application/octet-stream', urn: bubble.urn, guid: node.guid } ;
						// Construct the full urn path, similar to how it's stored for the SVF geometry items
						let intPath ='/' + node.intermediateFile ;
						if ( baseUrl.indexOf ('urn:adsk.objects') === 0 )
							intPath =encodeURIComponent (intPath) ;
						let fullPath =baseUrl + intPath ;
						self.extractPathsFromGraphicsUrn (fullPath, item) ;
						res.push (item) ;
					}
				}
			}
			if ( node.children ) {
				node.children.forEach ((child) => {
					traverse (child, node) ;
				}) ;
			}
		}) (bubble, null) ;

		console.log ('Manifests to process: ', res.length) ;
		if ( res.length === 0 )
			return (callback (null, { list: [], totalSize: 0 })) ;

		let current =0 ;
		let done =0 ;
		let estSize =0 ;
		let countedPropDb ={} ;

		let processOne =() => {
			function onProgress () {
				done++ ;
				console.log ('Manifests done ', done) ;
				if ( done === res.length ) {
					let result ={
						list: res,
						totalSize: estSize
					} ;
					callback (null, result) ;
				} else {
					setTimeout (processOne, 0) ;
				}
			}

			if ( current >= res.length )
				return ;
			let rootItem =res [current++] ;
			let basePath ;
			let files =rootItem.files =[] ;
			if ( rootItem.mime !== 'thumbnail' )
				basePath =rootItem.basePath ;
			if ( rootItem.mime === 'application/autodesk-db' ) {
				// The file list for property database files is fixed,
				// no need to go to the server to find out
				files.push ('objects_attrs.json.gz') ;
				files.push ('objects_vals.json.gz') ;
				files.push ('objects_avs.json.gz') ;
				files.push ('objects_offs.json.gz' );
				files.push ('objects_ids.json.gz') ;
				// f2d will reference us, but not the svf :( - add ourself here
				files.push (rootItem.rootFileName) ;
				onProgress () ;
			} else if ( rootItem.mime === 'thumbnail' ) {
				//rootItem.files.push ((rootItem.assetguid || rootItem.guid) + '.png') ;
				rootItem.files.push (rootItem.rootFileName) ;
				onProgress () ;
			} else if ( rootItem.mime === 'application/autodesk-svf' ) {
				let svfPath =rootItem.urn.slice (basePath.length) ;
				files.push (svfPath) ;
				// Closure to capture loop-variant variable for the getItem callback
				(() => {
					let myItem =rootItem ;
					self.getItem (rootItem.urn, null, (error, success) => {
						if ( error )
							self._errors.push ('Failed to download ' + myItem.urn) ;
						if ( success ) {
							let manifest ;
							try {
								let pack =new zip (success, { base64: false, checkCRC32: true }) ;
								success =pack.files ['manifest.json'].asNodeBuffer () ;
								manifest =JSON.parse (success.toString ('utf8')) ;
							} catch ( e ) {
								console.error ('Error:', e.message) ;
								self._errors.push (e.message) ;
							}
							if ( manifest && manifest.assets ) {
								for ( let j =0 ; j < manifest.assets.length ; j++ ) {
									let asset =manifest.assets [j] ;
									// Skip SVF embedded resources
									if ( asset.URI.indexOf ('embed:/') === 0 )
										continue ;
									// Skip non-local property db files
									// Those are listed explicitly in the bubble as property database role
									// so we will get them anyway
									if ( asset.URI.indexOf ('../') === 0 ) {
										// To get a correct bubble size estimate,
										// we get the property db file sizes from the SVF manifest,
										// because they are not available in the bubble itself.
										// It's ugly, but such is bubble life.
										// Also, this number seems to be the uncompressed size of the property db files,
										// so it's an overestimate, and we divide by 4 to get a more reasonable one.
										if ( !countedPropDb [rootItem.basePath] )
											estSize +=asset.size / 4 ;
										continue ;
									}
									estSize +=asset.size ;
									myItem.files.push (asset.URI) ;
								}
							}
							countedPropDb [rootItem.basePath] =1 ;
						}
						onProgress () ;
					}) ;
				}) () ;
			} else if ( rootItem.mime === 'application/autodesk-f2d' ) {
				files.push ('manifest.json.gz') ;
				let manifestPath =basePath + 'manifest.json.gz' ;
				// Closure to capture loop-variant variable for the getItem callback
				(() => {
					let myItem =rootItem ;
					self.getItem (manifestPath, null, (error, success) => {
						if ( error )
							self._errors.push ('Failed to download ' + myItem.urn) ;
						if ( success ) {
							estSize +=success.length ;
							let manifest ;
							try {
								if (success [0] === 0x1f && success [1] === 0x8b )
									success =zlib.gunzipSync (success) ;
								manifest =JSON.parse (success.toString ('utf8')) ;
							} catch ( e ) {
								console.error ('Error:',  e.message) ;
								self._errors.push (e.message) ;
							}
							if ( manifest && manifest.assets ) {
								for ( let j =0 ; j < manifest.assets.length ; j++ ) {
									let asset =manifest.assets [j] ;
									// Skip non-local property db files
									// Those are listed explicitly in the bubble as property database role
									// so we will get them anyway
									if ( asset.URI.indexOf ('../') === 0 )
										continue ;
									estSize +=asset.size ;
									myItem.files.push (asset.URI) ;
								}
							}
						}
						onProgress () ;
					}) ;
				}) () ;
			} else {
				// All other files are assumed to be just the file listed in the bubble
				files.push (rootItem.rootFileName) ;
				onProgress () ;
			}
		} ;
		// Kick off 6 parallel jobs
		for ( let k =0 ; k < 6 ; k++ )
			processOne () ;
	} ;

	this.downloadAllDerivativeFiles =(fileList, destDir, callback) => {
		let self =this ;
		let succeeded =0 ;
		let failed =0 ;
		let flatList =[] ;
		for ( let i =0 ; i < fileList.length ; i++ ) {
			let item =fileList [i] ;
			for (let j =0 ; j < item.files.length ; j++ ) {
				let flatItem ={
					basePath: item.basePath,
					localPath: destDir + item.localPath,
					fileName: item.files [j]
				} ;
				if ( item.name )
					flatItem.name =item.name ;
				if ( item.urn ) {
					flatItem.urn =item.urn ;
					flatItem.guid =item.guid ;
					flatItem.mime =item.mime ;
				}
				flatList.push (flatItem) ;
			}
		}
		if ( flatList.length === 0 )
			return (callback (failed, succeeded)) ;
		let current =0 ;
		let done =0 ;
		let downloadOneItem =() => {
			if ( current >= flatList.length )
				return ;
			let fi =flatList [current++] ;
			let downloadComplete =(error, success) => {
				done++ ;
				if ( error ) {
					failed++ ;
					console.error ('Failed to download file:', fi.localPath + fi.fileName, error) ;
					self._errors.push ('Failed to download file: ' + fi.localPath + fi.fileName) ;
				} else {
					succeeded++ ;
					console.log ('Downloaded:', fi.localPath + fi.fileName) ;
				}
				self._progress._progress =(100 * (failed + succeeded) / flatList.length) | 0 ;
				console.log ('Progress:', self._progress._progress, '%') ;
				if ( done === flatList.length )
					callback (failed, succeeded) ;
				else
					setTimeout (downloadOneItem, 0) ;
			} ;
			if ( fi.mime && fi.mime === 'thumbnail' )
				self.getThumbnail (fi.urn, fi.guid, 400, fi.localPath + fi.fileName, downloadComplete) ;
			else
				self.getItem (fi.basePath + fi.fileName, fi.localPath + fi.fileName, downloadComplete) ;
			if (   (   fi.mime == 'application/autodesk-svf'
					|| fi.mime == 'application/autodesk-f2d')
				&& (   path.extname (fi.fileName).toLowerCase () == '.svf'
					|| path.extname (fi.fileName).toLowerCase () == '.f2d')
			)
				self._viewables.push ({ path: ('./' + fi.localPath.substring (self._outPath.length) + fi.fileName), name: fi.name }) ;
		} ;
		// Kick off 10 parallel jobs
		for ( let k =0 ; k < 10 ; k++ )
			downloadOneItem () ;
	} ;

	this.extractPathsFromGraphicsUrn =(urn, result) => {
		// This needs to be done for encoded OSS URNs, because the paths
		// in there are url encoded and lose the / character.
		urn =decodeURIComponent (urn) ;
		let basePath =urn.slice (0, urn.lastIndexOf ('/') + 1) ;
		let localPath =basePath.slice (basePath.indexOf ('/') + 1) ;
		let urnBase =basePath.slice (0, basePath.indexOf ('/')) ;
		localPath =localPath.replace (/^output\//, '') ;
		// For supporting compound bubbles, we need to prefix
		// by sub-urn as well, otherwise files might clash.
		// let localPrefix = urnBase ? crypto.createHash('md5').update(urnBase).digest("hex") + "/" : "";
		let localPrefix ='' ;
		result.urn =urn ;
		result.basePath =basePath ;
		result.localPath =localPrefix + localPath ;
		result.rootFileName =urn.slice (urn.lastIndexOf ('/') + 1) ;
	} ;

	this.getManifest =(urn) => {
		// Verify the required parameter 'urn' is set
		if ( urn === undefined || urn === null )
			return (Promise.reject ("Missing the required parameter 'urn' when calling getManifest")) ;
		let ModelDerivative =new ForgeAPI.DerivativesApi () ;
		return (ModelDerivative.apiClient.callApi (
			'/derivativeservice/v2/manifest/{urn}', 'GET',
			{ 'urn': urn }, {}, { /*'Accept-Encoding': 'gzip, deflate'*/ },
			{}, null,
			[], [ 'application/vnd.api+json', 'application/json' ], null,
			this._token, this._token.getCredentials ()
		)) ;
	} ;

	this.downloadItem =(urn) => {
		// Verify the required parameter 'urn' is set
		if ( urn === undefined || urn === null )
			return (Promise.reject ("Missing the required parameter 'urn' when calling downloadItem")) ;
		let ModelDerivative =new ForgeAPI.DerivativesApi () ;
		return (ModelDerivative.apiClient.callApi (
			'/derivativeservice/v2/derivatives/{urn}', 'GET',
			{ 'urn': urn }, {}, { 'Accept-Encoding': 'gzip, deflate' },
			{}, null,
			[], [], null,
			this._token, this._token.getCredentials ()
		)) ;
	} ;

	this.openWriteStream =(outFile) => {
		let wstream ;
		if ( outFile ) {
			try {
				mkdirp.sync (path.dirname (outFile)) ;
				wstream =fs.createWriteStream (outFile) ;
			} catch ( e ) {
				console.error ('Error:', e.message) ;
			}
		}
		return (wstream) ;
	} ;

	this.getItem =(itemUrn, outFile, callback) => {
		let self =this ;
		//console.log ('-> ' + itemUrn) ;
		this.downloadItem (itemUrn)
			.then ((response) => {
				if ( response.statusCode !== 200 )
					return (callback (response.statusCode)) ;
				// Skip unzipping of items to make the downloaded content compatible with viewer debugging
				let wstream =self.openWriteStream (outFile) ;
				if ( wstream ) {
					wstream.write (typeof response.body == 'object' && path.extname (outFile) === '.json' ? JSON.stringify (response.body) : response.body) ;
					wstream.end () ;
					callback (null, response.statusCode) ;
				} else {
					callback (null, response.body) ;
				}
			})
			.catch ((error) => {
				console.error ('Error:', error.message) ;
				self._errors.push ('Error: ' + error.message) ;
				callback (error, null) ;
			})
			//.pipe (wstream)
		;
	} ;

	this.getThumbnail =(urn, guid, sz, outFile, callback) => {
		let self =this ;
		let ModelDerivative =new ForgeAPI.DerivativesApi () ;
		//console.log ('Thumbnail URN: ', urn, 'GUID: ', guid) ;
		//ModelDerivative.getThumbnail (urn, { width: sz, height: sz }, this._token, this._token.getCredentials ())
		//	.then ((thumbnail) => {
		//		//fs.writeFile (outFile, thumbnail.body) ;
		//		let wstream =self.openWriteStream (outFile) ;
		//		if ( wstream ) {
		//			wstream.write (thumbnail.body) ;
		//			wstream.end () ;
		//			callback (null, thumbnail.statusCode) ;
		//		} else {
		//			callback (null, thumbnail.body) ;
		//		}
		//	})
		//	.catch ((error) => {
		//		console.error ('Error:', error.message) ;
		//		self._errors.push ('Error: ' + error.message) ;
		//		callback (error, null) ;
		//	})
		//;
		if ( urn === undefined || urn === null )
			return (Promise.reject ("Missing the required parameter 'urn' when calling getThumbnail")) ;
		let queryParams ={ width: sz, height: sz, role: 'rendered' } ;
		if ( guid )
			queryParams.guid =guid ;
		ModelDerivative.apiClient.callApi (
			'/derivativeservice/v2/thumbnails/{urn}', 'GET',
			{ 'urn': urn }, queryParams, {},
			{}, null,
			[], [ 'application/octet-stream' ], null,
			this._token, this._token.getCredentials ()
		)
			.then ((thumbnail) => {
				//fs.writeFile (outFile, thumbnail.body) ;
				let wstream =self.openWriteStream (outFile) ;
				if ( wstream ) {
					wstream.write (thumbnail.body) ;
					wstream.end () ;
					callback (null, thumbnail.statusCode) ;
				} else {
					callback (null, thumbnail.body) ;
				}
			})
			.catch ((error) => {
				console.error ('Error:', error.message) ;
				self._errors.push ('Error: ' + error.message) ;
				callback (error, null) ;
			})
		;
	} ;

	//this.fixFlatBubbles =(result) => {
	//	// Trying to fix paths without breaking ones which are already good
	//	// We're lucky that our array is sorted by viewables
	//	let guid ='f0224dd3-8767-45c1-ff99-5c9c881b9fee' ;
	//	for ( let i =0 ; i < result.list.length ; i++ ) { // Find the first thumbnail guid to start with
	//		if ( result.list [i].mime === 'thumbnail' ) {
	//			guid =result.list [i].guid ;
	//			break ;
	//		}
	//	}
	//	for ( let i =0 ; i < result.list.length ; i++ ) {
	//		let obj =result.list [i] ;
	//		if ( obj.rootFileName === 'designDescription.json' ) {
	//			// Do nothing
	//		} else if ( obj.mime !== 'thumbnail' ) {
	//			if ( obj.localPath === '' )
	//				obj.localPath =guid + '/' ;
	//		} else { // Switch guid
	//			guid =obj.guid ;
	//		}
	//	}
	//} ;
	//
	//this.fixFusionBubbles =(result) => {
	//	// We're lucky that our array is sorted by viewables
	//	let bFusionFixRequired =false
	//	let guid ='f0224dd3-8767-45c1-ff99-5c9c881b9fee' ;
	//	for ( let i =0 ; i < result.list.length ; i++ ) { // Find the first thumbnail guid to start with
	//		let obj =result.list [i] ;
	//		if ( result.list [i].rootFileName === 'designDescription.json' ) {
	//			// Do nothing
	//		} else if ( obj.mime === 'thumbnail' ) {
	//			guid =obj.assetguid || obj.guid ;
	//			bFusionFixRrequired =obj.assetguid !== undefined ;
	//			break ;
	//		}
	//	}
	//	//if ( !bFusionFixRequired )
	//	//	return ;
	//	for ( let i =0 ; i < result.list.length ; i++ ) {
	//		let obj =result.list [i] ;
	//		if ( obj.mime !== 'thumbnail' ) {
	//			if (    bFusionFixRequired
	//				|| /^[0-9]+\/.*$/.test (obj.localPath)
	//				|| /^(Resource)\/.*$/.test (obj.localPath)
	//			) {
	//				let paths =obj.localPath.split ('/') ;
	//				paths [0] =guid ;
	//				obj.localPath =paths.join ('/') ;
	//			}
	//			//else if ( /^(Resource)\/.*$/.test (obj.localPath) ) {
	//			//	let paths =obj.localPath.split ('/') ;
	//			//	paths.unshift (guid) ;
	//			//	obj.localPath =paths.join ('/') ;
	//			//}
	//		} else { // Switch guid
	//			guid =obj.assetguid || obj.guid ;
	//		}
	//	}
	//} ;

}

function otgBubble (progress) {
	this._outPath ='./' ;
	this._token =null ;
	this._progress =progress ;
	//this._filesToFetch =0 ;
	//this._estimatedSize =0 ;
	//this._progress =0 ;
	this._viewables =[] ; // { path: '', name: '' }
	this._errors =[] ; // ''

	this.downloadBubble =(urn, outPath, token) => {
		let self =this ;
		if ( token ) {
			self._token =new ForgeAPI.AuthClientTwoLegged ('__', '__', [ 'data:read' ]) ;
			self._token.setCredentials ({
				'token_type': 'Bearer',
				'expires_in': 1799,
				'access_token': token
			}) ;
		} else {
			self._token =forgeToken.RW ;
		}
		self._outPath =outPath ;
		return (new Promise ((fulfill, reject) => {
			self._progress.msg ='Downloading manifest' ;
			self.data ={} ;
			self.getManifest (urn)
				.then ((bubble) => {
					let outFile =path.resolve (path.join (outPath, 'bubble.json')) ;
					console.log (outFile) ;
					utils.writeFile (outFile, bubble.body)
						.catch ((err) => {
							console.error ('Error:', err.message) ;
						}) ;

					// Code for GET /modeldata/manifest/{urn}

					// let otg_manifest =bubble.body.children.filter((elt) => { return (elt.role === 'viewable' && elt.otg_manifest) ; }) ;
					// if ( otg_manifest.length !== 1 )
					// 	throw new Error ('Unexpected OTG manifest format.') ;
					// otg_manifest =otg_manifest [0].otg_manifest ;

					// Code for GET /modeldata/otgmanifest/{urn}

					let otg_manifest =bubble.body ;

					//let views =Object.values (otg_manifest.views).filter ((elt) => { return (elt.role === 'graphics' && elt.urn.endsWith ('/otg_model.json') ) ; }) ;
					let views =Object.values (otg_manifest.views).filter ((elt) => { return (elt.role && elt.urn) ; }) ;
					if ( views.length === 0 )
						throw new Error ('Unexpected OTG manifest format.') ;

					self.data ={
						urn: urn,
						OTG_manifest: otg_manifest,
						
						global_root: otg_manifest.paths.global_root,
						global_sharding: otg_manifest.paths.global_sharding,
						version_root: otg_manifest.paths.version_root,
						shared_root: otg_manifest.paths.shared_root,
						region: otg_manifest.paths.region,

						local_version_root: path.join (outPath, otg_manifest.paths.version_root.substring (otg_manifest.paths.shared_root.length)),
						local_shared_root: path.join (outPath, otg_manifest.paths.shared_root),

						OTG_models: views.map ((elt) => { return (elt.urn) ; }),
						OTG_models_keys: Object.keys (otg_manifest.views)
					} ;
					console.log (JSON.stringify (self.data, null, 4)) ;

					//let l1 =['otg_model.json', 'fragments.fl', 'fragments_extra.fl', 'materials_ptrs.hl geometry_ptrs.hl texture_manifest.json]
					//download "modeldata/file/$OG_VERSION_ROOT$ENCODED_RELATIVE_ROOT/$asset" "$VERSION_ROOT/$asset"
					//let jobs =self.data.OTG_URN.map ((elt) => { return (self.downloadItem (self.data.OG_VERSION_ROOT + elt)) ; }) ;

					let jobs =self.data.OTG_models.map ((elt) => {
						return (self.getModel (self.data.version_root + encodeURI(elt), self.data.urn)) ;
					}) ;

					//return self.getModel (self.data.version_root + encodeURI(self.data.OTG_models[0]), self.data.urn) ;
					return (Promise.all (jobs.map (p => p.catch (() => undefined)))) ;
				})
				.then ((manifests) => {
					let jobs =manifests.map ((elt) => {
						return (utils.gunzip (elt.body)) ;
					}) ;
					return (Promise.all (jobs.map (p => p.catch (() => undefined)))) ;
				})
				.then ((manifestsjson) => {
					self.data.OTG_models_manifests =manifestsjson ;
					let jobs =manifestsjson.map ((elt, index) => {
						let outFile =path.resolve (path.join (self.data.local_version_root, 'otg_model.json')) ;
						console.log (' > ', outFile) ;
						return (utils.writeFile (outFile, elt));
					}) ;
					return (Promise.all (jobs)) ;
					//return (Promise.all (jobs.map (p => p.catch (() => undefined)))) ;
				})
				.then ((na) => {
					// let jobs =self.data.OTG_models_manifests.map ((elt, index) => {
					// 	let manifestJobs =elt.manifest.assets.map ((asset) => {
					// 		return (self.getModel (self.data.version_root + encodeURI(elt), self.data.urn)) ;
					// 	}) ;	
					// }) ;
					let jobs =self.data.OTG_models_manifests.map ((elt, index) => {
						let manifestJobs =elt.manifest.assets.map ((asset) => {
							return (self.getModel (self.data.version_root + encodeURI(elt), self.data.urn)) ;
						}) ;
						return (manifestJobs) ;
					}) ;
				})
				.catch ((err) => {
					console.error ('Error:', err.message || err.statusMessage) ;
					self._errors.push (err.message || err.statusMessage) ;
					reject (self) ;
				})
				// .finally ((p) => {
				// 	console.error (p) ;
				// });
			;
		})) ;
	} ;

	this.getManifest =(urn) => {
		// Verify the required parameter 'urn' is set
		if ( urn === undefined || urn === null )
			return (Promise.reject ("Missing the required parameter 'urn' when calling getManifest")) ;
		let ModelDerivative =new ForgeAPI.DerivativesApi () ;
		ModelDerivative.apiClient.basePath ='https://otg.autodesk.com' ;
		return (ModelDerivative.apiClient.callApi (
			//'/modeldata/manifest/{urn}', 'GET', // full manifest
			'/modeldata/otgmanifest/{urn}', 'GET', // only OTG manifest
			{ urn: urn }, {}, { /*'Accept-Encoding': 'gzip, deflate'*/ pragma: 'no-cache' },
			{}, null,
			[], [ 'application/vnd.api+json', 'application/json' ], null,
			this._token, this._token.getCredentials ()
		)) ;
	} ;

	this.getModel =(fileurn, modelurn) => {
		// Verify the required parameter 'urn' is set
		if ( !fileurn || !modelurn )
			return (Promise.reject ("Missing the required parameter 'urn' when calling downloadItem")) ;
		let ModelDerivative =new ForgeAPI.DerivativesApi () ;
		ModelDerivative.apiClient.basePath ='https://otg.autodesk.com' ;
		return (ModelDerivative.apiClient.callApi (
			'/modeldata/file/' + fileurn, 'GET',
			{}, { acmsession: modelurn }, { 'Accept-Encoding': 'gzip, deflate', pragma: 'no-cache' },
			{}, null,
			[], [ /*'application/vnd.api+json', 'application/json'*/ ], null,
			this._token, this._token.getCredentials ()
		)) ;
	} ;

}

let bubbleUtils ={
	// GenerateStartupFiles: (bubble, identifier) => {
	// 	return (new Promise ((fulfill, reject) => {
	// 		fs.createReadStream (utils.path ('views/readme.txt'))
	// 			.pipe (fs.createWriteStream (utils.path ('data/' + identifier + '/readme.txt'))) ;
	// 		fs.createReadStream (utils.path ('views/bat.ejs'))
	// 			.pipe (fs.createWriteStream (utils.path ('data/' + identifier + '/index.bat'))) ;
	// 		let ws =fs.createWriteStream (utils.path ('data/' + identifier + '/index')) ;
	// 		fs.createReadStream (utils.path ('views/bash.ejs'))
	// 			.pipe (ws) ;
	// 		ws.on ('finish', () => {
	// 			if ( /^win/.test (process.platform) === false )
	// 				fs.chmodSync (utils.path ('data/' + identifier + '/index'), 0777) ;
	// 		}) ;
	// 		utils.readFile (utils.path ('views/view.ejs'), 'utf-8')
	// 			.then ((st) => {
	// 				let data =ejs.render (st, { docs: bubble._viewables }) ;
	// 				let fullnameHtml =utils.path ('data/' + identifier + '/index.html') ;
	// 				return (utils.writeFile (fullnameHtml, data, 'utf-8')) ;
	// 			})
	// 			.then ((st) => {
	// 				fulfill (bubble) ;
	// 			})
	// 			.catch ((error) => {
	// 				reject (error) ;
	// 			})
	// 		;
	// 	})) ;
	// },
	//
	// AddViewerFiles: (bubble, identifier) => {
	// 	return (new Promise ((fulfill, reject) => {
	// 		let urns =viewerFileList.map ((item) => {
	// 			return (bubbleUtils.DownloadViewerItem ('/derivativeservice/v2/viewers/' + item, bubble._outPath, item)) ;
	// 		}) ;
	// 		Promise.all (urns)
	// 			.then ((urns) => {
	// 				let bower =utils.path ('www/bower_components') ;
	// 				let data =utils.path ('data/' + identifier) ;
	// 				fs.createReadStream (bower + '/jquery/dist/jquery.min.js')
	// 					.pipe (fs.createWriteStream (data + '/jquery.min.js')) ;
	// 				fs.createReadStream (bower + '/jquery-ui/jquery-ui.min.js')
	// 					.pipe (fs.createWriteStream (data + '/jquery-ui.min.js')) ;
	// 				fulfill (bubble) ;
	// 			})
	// 			.catch ((error) => {
	// 				console.error ('Something wrong happened during viewer files download') ;
	// 				reject (error) ;
	// 			})
	// 		;
	// 	})) ;
	// },
	//
	// DownloadViewerItem: (uri, outPath, item) => {
	// 	uri +='?v=v' + (config ? config.viewerVersion : '2.17') ;
	// 	return (new Promise ((fulfill, reject) => {
	// 		let ModelDerivative =new ForgeAPI.DerivativesApi () ;
	// 		ModelDerivative.apiClient.callApi (
	// 			uri, 'GET',
	// 			{}, {}, {},
	// 			{}, null,
	// 			[], [ 'application/octet-stream', 'image/png', 'text/html', 'text/css', 'text/javascript', 'application/json' ], null,
	// 			forgeToken.RW, forgeToken.RW.getCredentials ()
	// 		)
	// 			.then ((response) => {
	// 				//console.log (response.headers ['content-type'], item) ;
	// 				let body =response.body ;
	// 				if (   response.headers ['content-type'] == 'text/javascript'
	// 					|| response.headers ['content-type'] == 'text/css'
	// 				)
	// 					body =response.body.toString ('utf8') ;
	// 				if (   response.headers ['content-type'] == 'application/json'
	// 					|| response.headers ['content-type'] == 'application/json; charset=utf-8'
	// 				)
	// 					body =JSON.stringify (response.body) ;
	// 				console.log ('Downloaded:', outPath + item) ;
	// 				return (utils.writeFile (outPath + item, body, null, true)) ;
	// 			})
	// 			.then ((response) => {
	// 				fulfill (item) ;
	// 			})
	// 			.catch ((error) => {
	// 				console.error (error) ;
	// 				reject (error) ;
	// 			})
	// 		;
	// 	})) ;
	// },
	//
	// PackBubble: (inDir, outZip) => {
	// 	return (new Promise ((fulfill, reject) => {
	// 		try {
	// 			//let zip =new AdmZip () ;
	// 			//zip.addLocalFolder (inDir) ;
	// 			//zip.writeZip (outZip, (error, result) => {
	// 			//	if ( error )
	// 			//		reject (error) ;
	// 			//	else
	// 			//		fulfill (outZip) ;
	// 			//}) ;
	//
	// 			let archive =archiver ('zip') ;
	// 			archive.on ('error', (err) => {
	// 				console.error ('PackBubble: ' + err) ;
	// 				//reject (err) ;
	// 			}) ;
	// 			archive.on ('finish', (err) => {
	// 				if ( err ) {
	// 					console.error ('PackBubble: ' + err) ;
	// 					reject (err) ;
	// 				} else {
	// 					console.log ('PackBubble ended successfully.') ;
	// 					fulfill (outZip) ;
	// 				}
	// 			}) ;
	//
	// 			let output =fs.createWriteStream (outZip) ;
	// 			archive.pipe (output) ;
	// 			archive.directory (inDir, '') ;
	// 			archive.finalize () ;
	// 		} catch ( ex ) {
	// 			reject (ex) ;
	// 		}
	// 	})) ;
	// },
	//
	// NotifyPeopleOfSuccess: (identifier, locks) => {
	// 	return (bubbleUtils.NotifyPeople (identifier, locks, utils.path ('views/email-extract-succeeded.ejs'), 'Autodesk Forge Viewer Extractor notification')) ;
	// },
	//
	// NotifyPeopleOfFailure: (identifier, locks, error) => {
	// 	return (bubbleUtils.NotifyPeople (identifier, locks, utils.path ('views/email-extract-failed.ejs'), 'Autodesk Forge Viewer Extractor failure')) ;
	// },
	//
	// NotifyPeople: (identifier, locks, template, subject) => {
	// 	return (new Promise ((fulfill, reject) => {
	// 		utils.readFile (template, 'utf-8')
	// 			.then ((st) => {
	// 				let data =ejs.render (st, { ID: identifier }) ;
	// 				sendMail ({
	// 					'from': 'ADN Sparks <adn.sparks@autodesk.com>',
	// 					'replyTo': 'adn.sparks@autodesk.com',
	// 					'to': locks,
	// 					'subject': subject,
	// 					'html': data,
	// 					'forceEmbeddedImages': true
	// 				}) ;
	// 				fulfill () ;
	// 			})
	// 			.catch ((error) => {
	// 				console.error (error) ;
	// 				reject (error) ;
	// 			})
	// 		;
	// 	})) ;
	// }

} ;

module.exports ={
	svf: svfBubble,
	otg: otgBubble,
	utils: bubbleUtils
} ;
// Ds(endpoint, auth, oss) => {
// bubble-leech / index
