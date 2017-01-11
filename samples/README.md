# Forge Translate and View Sample Command Line Log

Clone [forge.commandline-nodejs](https://github.com/Autodesk-Forge/forge.commandline-nodejs):

```
/a/src/web/cyrille $ git clone https://github.com/Autodesk-Forge/forge.commandline-nodejs

/a/src/web/cyrille/forge.commandline-nodejs $ export FORGE_CLIENT_ID=PqZxxxxxxxxxxxxxxxxxxxxxxBE

/a/src/web/cyrille $ cd forge.commandline-nodejs $ export FORGE_CLIENT_SECRET=4fxxxxxxxEab

/a/src/web/cyrille $ cd forge.commandline-nodejs $ export FORGE_CALLBACK=http://localhost:3006/oauth

/a/src/web/cyrille/forge.commandline-nodejs $ npm install

/a/src/web/cyrille/forge.commandline-nodejs $ node forge-cb.js --help

  Usage: forge-cb [options] [command]

  Commands:

    2legged                                     get an application access token (2 legged)
    3legged [code]                              get an user access token (3 legged)
    3legged                                     3legged aboutme
    buckets [options]                           list local/server buckets
    bucket [bucketKey]                          set or get the current bucket
    bucketCreate [options] <bucketKey> [type]   create a new bucket,; default Type is transient, values can be transient/temporary/permanent
    bucketCheck [bucketKey]                     check bucket validity, outputs the expiration; date/time for this bucket; if no parameter use the current bucket
    bucketItems [options] [bucketKey]           list items in a given bucket; required to be in the API white list to use this API; if no parameter use the current bucket
    bucketDelete [bucketKey]                    delete a given bucket; if no parameter delete the current bucket
    upload <file>                               upload a file in the current bucket
    resumable <file> <pieces>                   upload a file in multiple pieces (i.e. resumables)
    download [options] <fileKey> <outputFile>   download the file from OSS
    objectDetails [options] <fileKey>           file information
    translate [options] <fileKey>               translate the file for viewing
    translateProgress [options] <fileKey>       file translation progress
    manifest [options] <fileKey>                file manifest
    metadata [options] <fileKey>                file metadata
    thumbnail [options] <fileKey> <outputFile>  get thumbnail
    deleteFile [options] <fileKey>              delete the source file from the bucket
    deleteManifest <fileKey>                    delete the manifest and all its translated output files (derivatives)
    html [options] <fileKey> <outputFile>       generate default html page

  Options:

    -h, --help     output usage information
    -V, --version  output the version number

   forge-cb command [arg]
    2legged
        - get an application access token (2 legged)
    3legged [code]
        - get an user access token (3 legged)
    aboutme
        - 3legged aboutme information
    buckets [-s [-a <startAt>] [-l <limit>] [-r <region>]]
        - list local buckets
          -s / --server : list buckets on the server
          -a / --startAt <startAt> : where to start in the list [string, default: none]
		  -l / --limit <limit> : how many to return [integer, default: 10]
		  -r / --region <region> : US or EMEA [string, default: US]
    bucket [<Name>]
        - set or get the current bucket
    bucketCreate <Name> [<Type>]
        - create a new bucket,
          default Type is transient, values can be
          transient/temporary/permanent
    bucketCheck [<Name>]
        - check bucket validity, outputs the expiration
          date/time for this bucket
          if no parameter use the current bucket
    bucketItems [<Name>] [-a <startAt>] [-l <limit>] [-r <region>]
        - list items in a given bucket
          if no parameter use the current bucket
          -a / --startAt <startAt> : where to start in the list [string, default: none]
		  -l / --limit <limit> : how many to return [integer, default: 10]
		  -r / --region <region> : US or EMEA [string, default: US]
    bucketDelete [<Name>]
        - delete a given bucket
          if no parameter delete the current bucket
    upload <File>
        - upload a file in the current bucket
    resumable <File> <Pieces>
        - upload a file in multiple pieces (i.e. resumables)
    download <FileKey> <OutputFile>
        - download the file from OSS
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    objectDetails <FileKey>
        - file information
           -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    translate <FileKey>
        - translate the file for viewing
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
          -e / --entry <rootFile> : which file to start from
    translateProgress <FileKey>
        - file translation progress
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    manifest <FileKey>
        - urn manifest
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    metadata <FileKey>
        - urn metadata
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    thumbnail <FileKey>
        - get thumbnail
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    deleteManifest <FileKey>
        - delete the manifest and all its translated output files (derivatives).
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    deleteFile <FileKey>
        - delete the source file from the bucket
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey
    html <FileKey> <OutputFile>
        - generate default html page
          -f / --file : fileKey represent the final objectKey on OSS vs a local fileKey

/a/src/web/cyrille/forge.commandline-nodejs $ node forge-cb.js 2legged
Your new 2-legged access token is: Bearer xRWpmzsXYXLqVciqIkX9iLTgMH1o
Expires at: 10/26/2016, 03:20:06 pm

/a/src/web/cyrille/forge.commandline-nodejs $ node forge-cb.js bucketCreate cyrille-20161025
Create bucket: cyrille-20161025
bucket created

/a/src/web/cyrille/forge.commandline-nodejs $ node forge-cb.js upload samples/Au.obj
Uploading file: samples/Au.obj
Upload successful
ID: urn:adsk.objects:os.object:cyrille-20161025/Au.obj
URN: dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Y3lyaWxsZS0yMDE2MTAyNS9BdS5vYmo=
Location: https://developer.api.autodesk.com/oss/v2/buckets/cyrille-20161025/objects/Au.obj

/a/src/web/cyrille/forge.commandline-nodejs $ node forge-cb.js translate Au.obj
Request file to be translated
Registration successfully submitted.
{
    "result": "success",
    "urn": "dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Y3lyaWxsZS0yMDE2MTAyNS9BdS5vYmo",
    "acceptedJobs": {
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
    }
}

/a/src/web/cyrille/forge.commandline-nodejs $ node forge-cb.js translateProgress Au.obj
Checking file translation progress
Request: success (complete)

/a/src/web/cyrille/forge.commandline-nodejs $ node forge-cb.js html Au.obj Au.html
Creating file: Au.html
Your viewer 2-legged access token is: Bearer 8h6YIp7WMiOjn0821SRwuAADM0E3
Expires at: 10/26/2016, 03:26:20 pm
File created

/a/src/web/cyrille/forge.commandline-nodejs $ ls
Au.html			README.md		forge-cb.js		node_modules		samples
LICENSE			data			forge-promise.js	package.json		views

/a/src/web/cyrille/forge.commandline-nodejs $ sudo npm install http-server -g
Password:

/a/src/web/cyrille/forge.commandline-nodejs $ http-server .
Starting up http-server, serving .
Available on:
  http://127.0.0.1:3000
  http://10.146.62.60:3000
Hit CTRL-C to stop the server
[Tue Oct 25 2016 15:27:32 GMT+0200 (CEST)] "GET /Au.html" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36"
[Tue Oct 25 2016 15:27:32 GMT+0200 (CEST)] "GET /favicon.ico" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36"
[Tue Oct 25 2016 15:27:32 GMT+0200 (CEST)] "GET /favicon.ico" Error (404): "Not found"
http-server stopped.

/a/src/web/cyrille/forge.commandline-nodejs $ vi Au.html
```

To capture the translated output stream, look at the manifest associated with the resulting URN and download all the streams.

This is demonstrated by [extract.autodesk.io](https://extract.autodesk.io).

Its code is available on GitHub at [cyrillef/extract.autodesk.io](https://github.com/cyrillef/extract.autodesk.io).

