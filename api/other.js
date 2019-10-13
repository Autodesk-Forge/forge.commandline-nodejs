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
/* eslint-disable no-multi-spaces */
/*jshint -W014 */

const ForgeAPI = require('forge-apis');

const ejs = require('ejs');
const fs = require('fs');
const _path = require('path');
const zlib = require('zlib');

const Bubble = require('./bubble');
const viewerFileList =require ('./viewer') ;
const utils = require('./utils');

class Forge_Other {

	static get oauth () { return (Forge_Other._oauth); }
	static set oauth (val) { Forge_Other._oauth = val; }
	static get viewerVersion () { return (Forge_Other._viewerVersion); }
	static set viewerVersion (val) { Forge_Other._viewerVersion = val; }
	static get viewerServerPath () { return ('https://developer.api.autodesk.com/modelderivative/v2/viewers'); }
	static get viewerLocalPath () { return (''); }
	static get endpoint () { return ('http://localhost:7124'); }

	// user (3legged)
	static userAboutMe (options) { // eslint-disable-line no-unused-vars
		console.log('About Me!...');
		Forge_Other.oauth.getOauth3Legged()
			.then((oa3Legged) => {
				let oa3Info = new ForgeAPI.UserProfileApi();
				return (oa3Info.getUserProfile(oa3Legged, oa3Legged.credentials));
			})
			.then((profile) => {
				console.log(JSON.stringify(profile.body, null, 4));
			})
			.catch((error) => {
				console.error('aboutme error:', error);
			});
	}

	// svf/otg bubble
	static bubble (urn, outputFolder, options) {
		console.log('Downloading Bubble for urn: ' + urn);
		if (urn.substring(0, 4) === 'urn:')
			urn = utils.safeBase64encode(urn);
		let _progress = {};
		let oauthClient = null;
		Forge_Other.oauth.getCredentials()
			.then((credentials) => {
				if (!credentials.refresh_token)
					return (Forge_Other.oauth.getOauth2Legged());
				else
					return (Forge_Other.oauth.getOauth3Legged());
			})
			.then((_oauthClient) => {
				oauthClient = _oauthClient;
				let obj = null;
				let otg = options.otg || options.parent.otg || false;
				if (otg)
					obj = new Bubble.otg(_progress);
				else
					obj = new Bubble.svf(_progress);
				obj.downloadBubble(urn, outputFolder + '/', oauthClient.credentials.access_token)
					.then((_bubble) => { // eslint-disable-line no-unused-vars
						console.log('Your bubble is ready at: ' + outputFolder);
					})
					.catch((error) => {
						throw error;
					});
			})
			.catch((error) => {
				if (error.message === 'Bubble already extracted!' || error.message === 'Bubble already being extracted!')
					return;
				console.error('Something went wrong while downloading your bubble!', error);
			});
	}

	// html/viewer
	static htmlGet (urn, outputFilename, options) { // eslint-disable-line no-unused-vars

		let render = (data, _outputFilename) => { // eslint-disable-line no-unused-vars
			return (new Promise((fulfill, reject) => {
				ejs.renderFile(_path.join(__dirname, '../views/index.ejs'), data, {}, (err, str) => {
					if (err)
						reject(err);
					fs.writeFile(outputFilename, str, (_err) => {
						if (_err)
							reject(_err);
						data.filename = outputFilename;
						fulfill(data);
					});
				});
			}));
		};

		console.log('Creating Viewer: ' + urn);
		if (urn.substring(0, 4) === 'urn:')
			urn = utils.safeBase64encode(urn);
		//let oauthClient = null;
		Forge_Other.oauth.getCredentials()
			.then((credentials) => {
				if (!credentials.refresh_token)
					return (Forge_Other.oauth.getOauth2Legged());
				else
					return (Forge_Other.oauth.getOauth3Legged());
			})
			.then((_oauthClient) => {
				//oauthClient = _oauthClient;
				let SvfOrOtg = (options.otg || options.parent.otg) ? 'otg' : 'svf';
				let localOptions = (/^(https?):.*$/g.test(urn) || urn[0] === '/') ? '_local' : '';
				let localServer = (options.local || options.parent.local) ? '' : Forge_Other.viewerServerPath;
				let data = {
					urn: urn,
					access_token: _oauthClient.credentials.access_token,
					version: Forge_Other.viewerVersion,
					viewer_path: localServer,
					endpoint: Forge_Other.endpoint,
					viewer_options: (SvfOrOtg + '_options' + localOptions)
				};
				return (render(data, outputFilename));
			})
			.then((info) => {
				console.log('Your HTML is ready at: ', info.filename);
			})
			.catch((error) => {
				console.error('Something went wrong while creating your local viewer!', error);
			});
	}

	// viewer
	static viewerGet (outputFolder, options) { // eslint-disable-line no-unused-vars
		console.log('Downloading Viewer');
		outputFolder = _path.resolve (outputFolder);

		let urns =viewerFileList.map ((item) => {
			return (Forge_Other.DownloadViewerItem (`/derivativeservice/v2/viewers/${item}?v=${Forge_Other.viewerVersion}`, outputFolder, item)) ;
		}) ;
		Promise.all (urns)
			.then ((_urns) => { // eslint-disable-line no-unused-vars
				console.log ('Download completed succesfully.');
				//fulfill (data) ;
			})
			.catch ((error) => { // eslint-disable-line no-unused-vars
				console.error ('Something wrong happened during viewer files download') ;
				//reject (error) ;
			})
		;
	}

	static DownloadViewerItem (uri, outPath, item) {
		return (new Promise (function (fulfill, reject) {
			let accepted = [ 'application/octet-stream', 'image/png', 'text/html', 'text/css', 'text/javascript', 'application/json' ] ;
			let ModelDerivative =new ForgeAPI.DerivativesApi () ;
			ModelDerivative.apiClient.callApi (
				uri, 'GET',
				{}, {}, {},
				{}, null,
				[], accepted, null,
				//forgeToken.RW, forgeToken.RW.getCredentials ()
				null, null
			)
				//.pipe (zlib.createGunzip ())
				.then ((response) => {
					let body =response.body ;
					if ( ['gzip', 'deflate'].indexOf (response.headers ['content-encoding']) !== -1 )
						body =zlib.gunzipSync (response.body) ;

					if (   response.headers ['content-type'] === 'text/javascript'
						|| response.headers ['content-type'] === 'text/css'
					)
						body =body.toString ('utf8') ;
					if (   response.headers ['content-type'] === 'application/json'
						|| response.headers ['content-type'] === 'application/json; charset=utf-8'
					)
						body =JSON.stringify (body) ;
					console.log (` >> ${_path.join(outPath, item)}`) ;
					return (utils.writeFile (_path.join(outPath, item), body, null, true)) ;
				})
				.then ((response) => { // eslint-disable-line no-unused-vars
					fulfill (item) ;
				})
				.catch ((error) => {
					console.error (error, `with: ${uri}`) ;
					reject (error) ;
				});
		})) ;
	}

}

module.exports = Forge_Other;