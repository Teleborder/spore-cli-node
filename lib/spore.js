var SporeApi = require('spore-api'),
    path = require('path'),
    fs = require('fs'),
    netrc = require('netrc-rw');

module.exports = Spore;

function Spore(options) {
  this.api = new SporeApi(options);
  this.dotSpore = ".spore";
  this.defaultEnv = "development";
  this.appNameVar = "SPORE_APP_NAME";
  this.envNameVar = "SPORE_ENV_NAME";
}

Spore.prototype.signup = function (email, password, callback) {
  var self = this;
  this.api.signup(email, password, function (err, user) {
    if(err) return callback(err);
    
    try {
      self._setKey(user.email, user.key);
    } catch(e) {
      return callback(e);
    }

    callback(null, user);
  });
};

Spore.prototype.login = function (email, password, callback) {
  var self = this;
  this.api.login(email, password, function (err, user) {
    if(err) return callback(err);
    
    try {
      self._setKey(user.email, user.key);
    } catch(e) {
      return callback(e);
    }

    callback(null, user);
  });
};

Spore.prototype.getAppAndEnv = function(dir, appName, envName, callback) {
  var spore = this;

  if(appName && envName) {
    return callback(null, appName, envName);
  }

  spore.readDotSpore(dir, function (err, env) {
    if(err) return callback(err);

    appName = appName || env[spore.appNameVar] || spore.lookupName(dir);
    envName = envName || env[spore.envNameVar] || spore.defaultEnv;

    callback(null, appName, envName);
  });
};

Spore.prototype.readDotSpore = function (dir, callback) {
  var spore = this;

  fs.readFile(path.join(dir, this.dotSpore), { encoding: 'utf8' }, function (err, contents) {
    var env = {};

    if(err && err.code === 'ENOENT') {
      // dot spore does not exist, so send back
      // an empty assignment
      return callback(null, env);
    }

    if(err) return callback(err);

    try {
      spore.readDotSporeContents(contents);
    } catch(e) {
      return callback(e);
    }

    callback(null, env);
  });
};

Spore.prototype.readDotSporeContents = function (contents) {
  var env = {};

  contents.split("\n").forEach(function (line, i) {

    // remove comments
    if(line.indexOf('#') > -1) {
      line = line.substring(0, line.indexOf('#'));
    }

    // skip blank lines
    if(line === "") {
      return;
    }

    var key,
        value;

    if(line.indexOf('=') === -1) {
      throw new Error("Invalid assignment on line " + i + 1 + ". " + line + " does not contain an `=`.");
    }

    key = line.substring(0, line.indexOf('='));
    value = line.substring(line.indexOf('=') + 1);

    env[key] = value;
  });

  return env;
};

Spore.prototype.writeDotSpore = function (appName, envName, dir, callback) {
  if(arguments.length < 4) {
    callback = dir;
    dir = envName;
    envName = this.defaultEnv;
  }

  var dotSpore = this.dotSpore;

  this.api.getDotSpore(appName, envName, function (err, contents) {
    if(err) return callback(err);

    fs.writeFile(path.join(dir, dotSpore), contents, callback);
  });
};

Spore.prototype.getDotSpore = function (appName, envName, callback) {
  var spore = this;

  if(arguments.length < 3) {
    callback = envName;
    envName = this.defaultEnv;
  }

  this.api.getDotSpore(appName, envName, function (err, contents) {
    if(err) return callback(err);

    try {
      contents = spore.readDotSporeContents(contents);
    } catch(e) {
      return callback(e);
    }

    callback(null, contents);
  });
};

Spore.prototype.lookupName = function (dir) {
  // check for node.js package name
  try {
    return require(path.join(dir, "package.json")).name;
  } catch(e) {
    // not a valid node application
  }
  
  // check for Rails application
  // TODO
  
  // fallback on directory name
  return path.basename(dir);
};

Spore.prototype._setKey = function (email, key) {
  if(!key) throw new Error("Key can't be blank.");

  netrc.read();

  if(!netrc.machines[this.host]) {
    netrc.addMachine(this.host, {});
  }

  netrc.host(this.host).login = email;
  netrc.host(this.host).password = key;

  this.api.setKey(key);

  netrc.write();
};

Spore.prototype.getKey = function () {
  var key;

  try {
    key = netrc.host(this.host).password;

    this.api.setKey(key);
  } catch(e) {
    return false;
  }

  return key;
};
