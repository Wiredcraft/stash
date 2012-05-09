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
    if (!this._file) {
        return key.replace(/^\W/g, '').replace(/\W/g, '.');
    } else {
        // Keep the '/' as such, will be used to maintain subfolder structure
        // Prevent from walking up the folders ../)
        return key.replace(/^\W/g, '')
                  .replace(/[^a-zA-Z0-9_\/]/g, '.')
                  .replace(/\/[\.]+\//g, '.');
    }
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
    }
};

/**
 * Load database from file system. Blocking - expected to be called at
 * application 'start time'.
 */
Stash.prototype._load = function() {
    try { fs.mkdirSync(this._path, 0755); } catch(e) {};

    // either load the files from within the _path folder
    // or recursively walk through the subfolders looking for _file 
    if (!this._file) {
        var files = fs.readdirSync(this._path);
        for (var i = 0; i < files.length; i++) {
            var key = files[i].replace(/.json$/, ''),
                data = fs.readFileSync(path.join(this._path, files[i]), 'utf8');
            try {
                this._docs[key] = JSON.parse(data);
            } catch (e) {
                console.error('Could not load %s %s', key, e);
            }
        }
    } else {
        var docs = this._docs;
        var recRead = function(path) {
            // var files = fs
            // TO COMPLETE
        }
    }
};

module.exports = function(path, file) {
    !stashes[path] && (stashes[path] = new Stash(path, file));
    return stashes[path];
};

