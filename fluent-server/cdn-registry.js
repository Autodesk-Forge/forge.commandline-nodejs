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

const _path = require('path');

class CDNRegistry {

	static get cdns () {
		if (!CDNRegistry._cdns)
			CDNRegistry._cdns = {};
		return (CDNRegistry._cdns);
	}
	//static set cdns (val) { CDNRegistry._cdns =val ; }

	static get repositories () {
		if (!CDNRegistry._repositories)
			CDNRegistry._repositories = _path.resolve(process.env.REPOS || process.argv[2] || process.cwd());
		return (CDNRegistry._repositories);
	}
	static set repositories (val) { CDNRegistry._repositories = val; }

	static buildCDNS (root, accountid, refid, urn) { // eslint-disable-line no-unused-vars
		if (CDNRegistry.get(refid))
			return (CDNRegistry.get(refid));
		CDNRegistry._cdns[refid] = {
			server: '..',
			repopath: CDNRegistry._repositories, //_path.resolve(_path.join(__dirname, '..')),
			root: root,
			rootpath: '',
			viewroot: '',
			accountid: accountid,
			refid: refid,
			//urn: urn
		};
		CDNRegistry._cdns[accountid] = CDNRegistry._cdns[refid];
		return (CDNRegistry.get(refid));
	}

	static buildCDN (id, path) {
		let cdn = CDNRegistry.get(id);
		if (cdn.g)
			return (cdn);
		let filename = _path.resolve(_path.join(cdn.repopath, cdn.root, path));
		// The viewer is using harcoded paths rather than reading the manifest
		// that means we need to either read the manifest synchronously or set
		// our cdn object that same way the viewer is doing
		cdn.viewroot = _path.dirname(filename);
		cdn.rootpath = _path.join(cdn.repopath, cdn.root);
		cdn.g = _path.resolve(_path.join(cdn.rootpath, '/cdn/g'));
		cdn.m = _path.resolve(_path.join(cdn.rootpath, '/cdn/m'));
		cdn.t = _path.resolve(_path.join(cdn.rootpath, '/cdn/t'));
		return (cdn);
	}

	static get (id) {
		return (CDNRegistry.cdns[id]);
	}

}

module.exports = CDNRegistry;
