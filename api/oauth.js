//
// Copyright (c) 2019 Autodesk, Inc.
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

const ForgeAPI = require('forge-apis');
const moment = require('moment');
const opn = require('open');
const http = require('http');
const url = require('url');
const path = require('path');
const ejs = require('ejs');
const utils = require('./utils');

class Forge_oauth {

	static get settings () {
		return (Forge_oauth._settings);
	}

	static set settings (val) {
		Forge_oauth._settings = val;
	}

	static localToken (token, refresh, options) { // eslint-disable-line no-unused-vars
		utils.json('credentials')
			.then((credentials) => {
				if (token)
					credentials.access_token = token;
				let bearer = 'Bearer ' + credentials.access_token;
				console.log('Your current access token is: ' + bearer);
				if (refresh)
					credentials.refresh_token = refresh;
				else if (credentials.refresh_token)
					delete credentials.refresh_token;
				let dt = moment().add(credentials.expires_in, 'seconds');
				if (token) {
					credentials.expires_at = dt.toString();
					console.log(utils.data('credentials'));
					return (utils.writeFile(utils.data('credentials'), credentials));
				} else {
					return (credentials);
				}
			})
			.catch((err) => {
				return (console.error('Failed to read/create credentials file', err));
			});
	}

	// oauth 2 legged
	static _2legged (options) { // eslint-disable-line no-unused-vars
		Forge_oauth.callOauth2Legged()
			.catch((error) => { // eslint-disable-line no-unused-vars
				console.error('Failed to get a new token!', error);
			});
	}

	static _2leggedRelease (options) { // eslint-disable-line no-unused-vars
		utils.unlink(utils.data('credentials'));
		console.log('Your 2 legged token has been released!');
	}

	// oauth 3 legged
	static render (template, data, res) {
		template = template || 'signed-in.ejs';
		return (new Promise((fulfill, reject) => { // eslint-disable-line no-unused-vars
			ejs.renderFile(path.normalize(path.join(__dirname, '/../views/', template)), data, {}, (err, str) => {
				res.writeHeader(200, { 'Content-Type': 'text/html' });
				if (err)
					res.write(`${data.result}. ${data.message}`);
				else
					res.write(str);
				res.end();
				fulfill();
			});
		}));
	}

	static _3legged_authorize (auto, implicit) {
		let oa3Legged = new ForgeAPI.AuthClientThreeLegged(Forge_oauth.settings.clientId, Forge_oauth.settings.clientSecret, Forge_oauth.settings.callback, Forge_oauth.settings.opts.scope.split(' '), true);
		// Generate a URL page that asks for permissions for the specified scopes.
		let uri = oa3Legged.generateAuthUrl();
		if ( implicit ) {
			uri = uri.replace('response_type=code', 'response_type=token');
		}
		opn(
			uri
			/*, { app: [
				'google chrome',
				'--incognito'
			] }*/
		);

		if (auto) {
			let q = url.parse(Forge_oauth.settings.callback, true);
			/*let server =*/http.createServer((req, res) => {
				if (req.method === 'GET' && req.url.indexOf(q.path) !== -1) {
					let query = url.parse(req.url, true);
					if ( implicit && Object.keys(query.query).length === 0 ) {
						return (Forge_oauth.render('implicit.ejs', {}, res));
					} else if ( implicit && Object.keys(query.query).length !== 0 ) {
						Forge_oauth.setCredentials(query.query, '3 legged');
						let data = {
							result: 'You are Signed in',
							message: 'You can now close this window'
						};
						Forge_oauth.render('signed-in.ejs', data, res)
							.finally(() => {
								setTimeout(() => { process.exit(); }, 1000);
							});
						return;
					}
					Forge_oauth._3legged_code(query.query.code)
						.then((client) => { // eslint-disable-line no-unused-vars
							let data = {
								result: 'You are Signed in',
								message: 'You can now close this window'
							};
							return (Forge_oauth.render('signed-in.ejs', data, res));
						})
						.then(() => {
							setTimeout(() => { process.exit(); }, 1000);
						})
						.catch((error) => { // eslint-disable-line no-unused-vars
							let data = {
								result: 'An error occured, sorry!',
								message: 'You can now close this window'
							};
							Forge_oauth.render('signed-in.ejs', data, res)
								.finally(() => {
									setTimeout(() => { process.exit(); }, 1000);
								});
						});
					//server.close () ;
				}
			}).listen(Forge_oauth.settings.PORT);
		} else {
			console.log('Wait for the browser to return a code and run this script again with the code as parameter...');
			process.exit();
		}
	}

	static _3legged_refresh () {
		let oa3Legged = new ForgeAPI.AuthClientThreeLegged(Forge_oauth.settings.clientId, Forge_oauth.settings.clientSecret, Forge_oauth.settings.callback, Forge_oauth.settings.opts.scope.split(' '), true);
		Forge_oauth.getCredentials()
			.then((credentials) => {
				return (oa3Legged.refreshToken(credentials));
			})
			.then((credentials) => {
				return (Forge_oauth.setCredentials(credentials, '3 legged'));
			})
			.catch((error) => {
				//utils.unlink (utils.data ('credentials')) ;
				console.error('Failed to refresh your credentials', error);
			});
	}

	static _3legged_code (code) {
		return (new Promise((fulfill, reject) => {
			let oa3Legged = new ForgeAPI.AuthClientThreeLegged(Forge_oauth.settings.clientId, Forge_oauth.settings.clientSecret, Forge_oauth.settings.callback, Forge_oauth.settings.opts.scope.split(' '), true);
			oa3Legged.getToken(code)
				.then((credentials) => {
					return (Forge_oauth.setCredentials(credentials, '3 legged'));
				})
				.then((credentials) => {
					oa3Legged.credentials = credentials;
					fulfill(oa3Legged);
				})
				.catch((error) => {
					//utils.unlink (utils.data ('credentials')) ;
					console.error('Failed to get your credentials', error);
					reject(error);
				});
		}));
	}

	static _3legged_release (options) { // eslint-disable-line no-unused-vars
		utils.unlink(utils.data('credentials'));
		console.error('Your 3 legged token has been released!');
	}

	static _3legged (code, options) {
		let implicit = options.implicit || options.parent.implicit || false;
		switch (code) {
			case undefined:
			case null:
			case '':
			case 'auto':
				Forge_oauth._3legged_authorize(code === 'auto', implicit);
				break;
			case 'refresh':
				Forge_oauth._3legged_refresh();
				break;
			case 'logout':
				Forge_oauth._3legged_release();
				break;
			default:
				Forge_oauth._3legged_code(code);
				break;
		}
	}

	static getCredentials () {
		return (utils.json('credentials'));
	}

	static setCredentials (credentials, type) {
		type = type || '2 legged';
		let token = credentials.token_type + ' ' + credentials.access_token;
		console.log('Your new ' + type + ' access token is: ' + token);
		let dt = moment().add(credentials.expires_in, 'seconds');
		console.log('Expires at: ' + dt.format('MM/DD/YYYY, hh:mm:ss a'));
		return (utils.writeFile(utils.data('credentials'), credentials));
	}

	static expired (expires_at) {
		return (moment(expires_at) <= moment());
	}

	static callOauth2Legged () {
		return (new Promise((fulfill, reject) => {
			console.info('Requesting a new 2 legged access token...');
			let oa2Legged = new ForgeAPI.AuthClientTwoLegged(Forge_oauth.settings.clientId, Forge_oauth.settings.clientSecret, Forge_oauth.settings.opts.scope.split(' '), true);
			oa2Legged.authenticate()
				.then((credentials) => {
					return (Forge_oauth.setCredentials(credentials, '2 legged'));
				})
				.then((credentials) => { // eslint-disable-line no-unused-vars
					fulfill(oa2Legged);
				})
				.catch((error) => {
					//utils.unlink (utils.data ('credentials')) ;
					console.error('Failed to get your new access token', error);
					reject(error);
				});
		}));
	}

	static getOauth2Legged () {
		return (new Promise((fulfill, reject) => {
			Forge_oauth.getCredentials()
				.then((credentials) => {
					if (credentials.refresh_token)
						throw new Error('This is a 3 legged token!'); // Get a new 2 legged one instead!
					if (Forge_oauth.expired(credentials.expires_at))
						throw new Error('2 legged token has expired, trying to renew now!'); // even if we could use the SDK auto-renew feature
					let oa2Legged = new ForgeAPI.AuthClientTwoLegged(Forge_oauth.settings.clientId, Forge_oauth.settings.clientSecret, Forge_oauth.settings.opts.scope.split(' '), true);
					oa2Legged.setCredentials(credentials);
					fulfill(oa2Legged);
				})
				.catch((error) => { // eslint-disable-line no-unused-vars
					Forge_oauth.callOauth2Legged()
						.then((client) => {
							fulfill(client);
						})
						.catch((err2) => {
							//utils.unlink (utils.data ('credentials')) ;
							reject(err2);
						});
				});
		}));
	}

	static getOauth3Legged () {
		return (new Promise((fulfill, reject) => {
			Forge_oauth.getCredentials()
				.then((credentials) => {
					if (!credentials.refresh_token)
						throw new Error('This is a 2 legged token!');
					let oa3Legged = new ForgeAPI.AuthClientThreeLegged(Forge_oauth.settings.clientId, Forge_oauth.settings.clientSecret, Forge_oauth.settings.callback, Forge_oauth.settings.opts.scope.split(' '), true);
					if (Forge_oauth.expired(credentials.expires_at)) { // Try to refresh the token using its refresh_token
						oa3Legged.refreshToken(credentials)
							.then((_credentials) => {
								oa3Legged.credentials = _credentials;
								return (Forge_oauth.setCredentials(_credentials, '3 legged'));
							})
							.then((_credentials) => { // eslint-disable-line no-unused-vars
								fulfill(oa3Legged);
							})
							.catch((error) => {
								//utils.unlink (utils.data ('credentials')) ;
								console.error('Failed to refresh your credentials', error);
								reject(error);
							});
					} else {
						oa3Legged.credentials = credentials;
						fulfill(oa3Legged);
					}
				})
				.catch((error) => {
					reject(error);
				});
		}));
	}

}

module.exports = Forge_oauth;
