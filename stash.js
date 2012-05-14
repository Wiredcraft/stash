var fs = require('fs'),
    path = require('path'),
    EventEmitter = require('events').EventEmitter,
    stashes = {};

var Stash = function(path, file) {
    this._docs = {};
    this._path = path;
    this._file = file || false;
    this._load();
};

/**
 * Saves an existing key.
 */
Stash.prototype.set = function(key, val, callback) {
    this._docs[this.key(key)] = val;
    this._flush(callback);
};

/**
 * Retrieve document at given key.
 */
Stash.prototype.get = function(key) {
    return this._docs[this.key(key)];
};

/**
 * List all documents.
 */
Stash.prototype.list = function() {
    return this._docs;
};

/**
 * Remove a document.
 */
Stash.prototype.rm = function(key, callback) {
    delete this._docs[this.key(key)];
    this._flush(callback);
};

/**
 * Sanitize and prettify key for filesystem. Replaces filesystem-unsafe
 * characters with '.' and removes cruft from the front of the key.
 */
Stash.prototype.key = function(key) {
    return key.replace(/^\W/g, '').replace(/\W/g, '.');
};

/**
 * Flush database to disk.
 */
Stash.prototype._flush = function(callback) {
    var that = this,
        queue = 0,
        trigger = new EventEmitter(),
        dequeue = function() {
            queue--;
            !queue && trigger.emit('complete');
        };

    callback && trigger.on('complete', callback);

    // either use the file of folder based method to flush the keys
    if (!this._file) {
        fs.readdir(that._path, function(err, files) {
            if (err) throw err;
    
            // Remove files that are no longer in the database.
            for (var i = 0; i < files.length; i++) {
                var key = files[i].replace(/.json$/, '');
                if (that._docs[key]) continue;

                queue++;
                fs.unlink(
                    path.join(that._path, files[i]),
                    dequeue
                );
            }
            // Write files from database.
            for (var key in that._docs) {
                queue++;
                fs.writeFile(
                    path.join(that._path, key + '.json'),
                    JSON.stringify(that._docs[key], null, 4),
                    'utf8',
                    dequeue
                );
            }
        });
    } else {
        // recursively walk through the subfolders looking for the _file
        // TO COMPLETE

        // fs.readdir(that._path, function(err, files) {
        //     if (err) throw err;
        //     
        //     // Remove files that are no longer in the database.
        //     for (var i = 0; i < files.length; i++) {
        //         var key = files[i].replace(/.json$/, '');
        //         if (that._docs[key]) continue;
        // 
        //         queue++;
        //         fs.unlink(
        //             path.join(that._path, files[i]),
        //             dequeue
        //         );
        //     }
        //     // Write files from database.
        //     for (var key in that._docs) {
        //         queue++;
        //         fs.writeFile(
        //             path.join(that._path, key + '.json'),
        //             JSON.stringify(that._docs[key], null, 4),
        //             'utf8',
        //             dequeue
        //         );
        //     }
        // });
        
    }
};

/**
 * Load database from file system. Blocking - expected to be called at
 * application 'start time'.
 */
Stash.prototype._load = function() {
    try { fs.mkdirSync(this._path, 0755); } catch(e) {};
    
    var that = this;
    
    // either load the files from within the _path folder
    // or recursively walk through the subfolders looking for _file 
    if (!that._file) {
        var files = fs.readdirSync(that._path);
        for (var i = 0; i < files.length; i++) {
            var key = files[i].replace(/.json$/, ''),
                data = fs.readFileSync(path.join(that._path, files[i]), 'utf8');
            try {
                that._docs[key] = JSON.parse(data);
            } catch (e) {
                console.error('Could not load %s %s', key, e);
            }
        }
    } else {
        // var docs = that._docs;
        // var filesJson = [];
        var rootPath = that._path;
        
        var readFolder = function(curPath, root) {
            var files = fs.readdirSync(curPath);
            for (var i = 0; i < files.length; i++) {
                var stat = fs.statSync(path.join(curPath, files[i]));
                if (stat.isDirectory()) {
                    // if is folder recursive search
                    readFolder(path.join(curPath, files[i]), root);
                } else {
                    // if is file, only consider whether the filename is matching
                    if (files[i] === that._file) {
                        // remove the root of the file and convert remaining / by __
                        var key = curPath.replace(root+'/', '').replace('/', '__'),
                            data = fs.readFileSync(path.join(curPath, files[i]), 'utf8');
                        try {
                            that._docs[key] = JSON.parse(data);
                        } catch (e) {
                            console.error('Could not load %s %s', key, e);
                        }
                    }
                }
            }
        }
        readFolder(that._path, rootPath);
    }
};

module.exports = function(path, file) {
    !stashes[path] && (stashes[path] = new Stash(path, file));
    return stashes[path];
};