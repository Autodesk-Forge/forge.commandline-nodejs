
[![build status](https://api.travis-ci.org/cyrillef/models.autodesk.io.png)](https://travis-ci.org/cyrillef/models.autodesk.io)
[![Node.js](https://img.shields.io/badge/Node.js-5.11.1-blue.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-3.9.3-blue.svg)](https://www.npmjs.com/)
![Platforms](https://img.shields.io/badge/platform-windows%20%7C%20osx%20%7C%20linux-lightgray.svg)
[![License](http://img.shields.io/:license-mit-blue.svg)](http://opensource.org/licenses/MIT)

*Forge API*:
[![oAuth2](https://img.shields.io/badge/oAuth2-v1-green.svg)](http://developer-autodesk.github.io/)
[![Data-Management](https://img.shields.io/badge/Data%20Management-v2-green.svg)](http://developer-autodesk.github.io/)
[![OSS](https://img.shields.io/badge/OSS-v2-green.svg)](http://developer-autodesk.github.io/)
[![Model-Derivative](https://img.shields.io/badge/Model%20Derivative-v2-green.svg)](http://developer-autodesk.github.io/)
[![Viewer](https://img.shields.io/badge/Forge%20Viewer-v2.9-green.svg)](http://developer-autodesk.github.io/)


# forge.commandline-nodejs

<b>Note:</b> For using this sample, you need a valid oAuth credential for the translation / extraction portion.
Visit this [page](https://developer.autodesk.com) for instructions to get on-board.


Demonstrates the Autodesk Forge API authorisation and translation process using a Node.js console application.


## Installation

Download this project and install dependencies
```shell
npm install
```

#### For browser
The library also works in the browser environment via npm and [browserify](http://browserify.org/). After following
the above steps with Node.js and installing browserify with `npm install -g browserify`,
perform the following (assuming *main.js* is your entry file):

```shell
browserify main.js > bundle.js
```

Then include *bundle.js* in the HTML pages.


## Getting Started
Please follow the [installation](#installation) instruction and execute the following JS code:

This libray can either use callbacks ot Promises. Do not provide a callback parameter to use Promises.

#### callback version
```javascript
var ForgeOauth2 =require ('forge-oauth2') ;

var api =new ForgeOauth2.InformationalApi()

var callback =function (error, data, response) {
  if ( error ) {
    console.error (error) ;
  } else {
    console.log ('API called successfully. Returned data: ' + data) ;
  }
};
api.aboutMe(callback) ;

```

#### Promise version
```javascript
var ForgeOauth2 =require ('forge-oauth2') ;

var api =new ForgeOauth2.InformationalApi()

api.aboutMe().then (function (data) {
  console.log ('API called successfully. Returned data: ' + data) ;
}, function (error) {
  console.error (error) ;
}) ;

```


## Documentation for API Endpoints

All URIs are relative to *https://developer.api.autodesk.com/*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*ForgeOauth2.InformationalApi* | [**aboutMe**](docs/InformationalApi.md#aboutMe) | **GET** /userprofile/v1/users/@me | GET users/@me
*ForgeOauth2.ThreeLeggedApi* | [**authorize**](docs/ThreeLeggedApi.md#authorize) | **GET** /authentication/v1/authorize | GET authorize
*ForgeOauth2.ThreeLeggedApi* | [**gettoken**](docs/ThreeLeggedApi.md#gettoken) | **POST** /authentication/v1/gettoken | POST gettoken
*ForgeOauth2.ThreeLeggedApi* | [**refreshtoken**](docs/ThreeLeggedApi.md#refreshtoken) | **POST** /authentication/v1/refreshtoken | POST refreshtoken
*ForgeOauth2.TwoLeggedApi* | [**authenticate**](docs/TwoLeggedApi.md#authenticate) | **POST** /authentication/v1/authenticate | POST authenticate



## Documentation for Models

 - [ForgeOauth2.Bearer](docs/Bearer.md)
 - [ForgeOauth2.OAuthError](docs/OAuthError.md)
 - [ForgeOauth2.UserProfile](docs/UserProfile.md)



## Documentation for Authorization

 All endpoints do not require authorization.



## Documentation & Support
For more information, please visit [https://developer.autodesk.com/en/docs/oauth/v2/](https://developer.autodesk.com/en/docs/oauth/v2/)

For support, please use [http://stackoverflow.com/questions/tagged/autodesk-forge+oauth](http://stackoverflow.com/questions/tagged/autodesk-forge+oauth)

--------

## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT). Please see the [LICENSE](LICENSE) file for full details.


