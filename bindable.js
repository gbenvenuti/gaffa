var createSpec = require('spec-js'),
    EventEmitter = require('events').EventEmitter,
    jsonConverter = require('./jsonConverter');

var stack = [];
function eventually(fn){
    stack.push(fn);
    if(stack.length === 1){
        setTimeout(function(){
            while(stack.length){
                stack.pop()();
            }
        },100);
    }
}

function getItemPath(item){
    var gedi = item.gaffa.gedi,
        paths = [],
        referencePath,
        referenceItem = item;

    while(referenceItem){

        // item.path should be a child ref after item.sourcePath
        if(referenceItem.path != null){
            paths.push(referenceItem.path);
        }

        // item.sourcePath is most root level path
        if(referenceItem.sourcePath != null){
            paths.push(gedi.paths.create(referenceItem.sourcePath));
        }

        referenceItem = referenceItem.parent;
    }

    return gedi.paths.resolve.apply(this, paths.reverse());
}

var iuid = 0;

function Bindable(){
    this.setMaxListeners(1000);
    // instance unique ID
    this.__iuid = iuid++;
}
Bindable = createSpec(Bindable, EventEmitter);
Bindable.bindables = {};
Bindable.getByIuid = function(id){
    return this.bindables[id];
};
Bindable.prototype.getPath = function(){
    return getItemPath(this);
};
Bindable.prototype.getDataAtPath = function(){
    if(!this.gaffa){
        return;
    }
    return this.gaffa.model.get(getItemPath(this));
};
Bindable.prototype.toJSON = function(){
    var tempObject = jsonConverter(this, this.__serialiseExclude__, this.__serialiseInclude__);

    return tempObject;
};

function setupCleanup(bindable, parent){
    var onDebind = bindable.debind.bind(bindable);
    parent.once('debind', onDebind);
    bindable.once('debind', function(){
        bindable.parent.removeListener('debind', onDebind);
    });

    var onDestroy = bindable.destroy.bind(bindable);
    parent.once('destroy', onDestroy);
    bindable.once('destroy', function(){
        bindable.parent.removeListener('destroy', onDestroy);
    });
}

Bindable.prototype.bind = function(parent){
    if(parent && !parent._bound){
        console.warn('Attempted to bind to a parent who was not bound.');
        return;
    }
    if(this._bound){
        this.debind();
        console.warn('Attempted to bind an already bound item.');
    }

    if(parent){
        this.gaffa = parent.gaffa;
        this.parent = parent;
        this._parentId = parent.__iuid;

        setupCleanup(this, parent);
    }

    this.updatePath();

    this._bound = true;
    Bindable.bindables[this.__iuid] = this;
    this.emit('bind');
    this.removeAllListeners('bind');
};
Bindable.prototype.getSourcePath = function(){
    return this.gaffa.gedi.paths.resolve(this.parent && this.parent.getPath(), this.sourcePath);
}
Bindable.prototype.updatePath = function(){
    if(!this.pathBinding){
        return;
    }

    var bindable = this,
        absoluteSourcePath = this.getSourcePath(),
        lastPath = this.path,
        gaffa = this.gaffa;

    function setPath(valueTokens){
        if(valueTokens){
            var valueToken = valueTokens[valueTokens.length - 1];
            bindable.path = valueToken.sourcePathInfo && valueToken.sourcePathInfo.path;
        }

        if(lastPath !== bindable.path && bindable._bound){
            bindable.debind();
            bindable.bind(bindable.parent);
        }
    }

    setPath(gaffa.gedi.get(this.pathBinding, absoluteSourcePath, bindable.scope, true));

    function handlePathChange(event){
        setPath(gaffa.model.get(bindable.pathBinding, bindable, bindable.scope, true));
    }

    gaffa.gedi.bind(this.pathBinding, handlePathChange, absoluteSourcePath);
    this.on('debind', function(){
        gaffa.gedi.debind(bindable.pathBinding, handlePathChange, absoluteSourcePath);
    });
};
Bindable.prototype.debind = function(){
    var bindable = this;

    if(!this._bound){
        // ToDo: This happens with actions, resolve.
        return;
    }
    this._bound = false;

    this.emit('debind');
    this.removeAllListeners('debind');
    delete Bindable.bindables[this.__iuid];
};
Bindable.prototype.destroy = function(){
    var bindable = this;

    this._destroyed = true;

    if(this._bound){
        this.debind();
    }

    for(var key in this){
        if(key !== 'parent' && this[key] instanceof Bindable && this[key]._bound){
            console.log(key);
        }
    }

    // Destroy bindables asynchonously.
    eventually(function(){

        bindable.emit('destroy');
        bindable.removeAllListeners('destroy');

        // Let any children bound to 'destroy' do their thing before actually destroying this.
        eventually(function(){
            bindable.gaffa = null;
            bindable.parent = null;
        });
    });
};

module.exports = Bindable;