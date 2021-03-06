var Property = require('./property'),
    statham = require('statham'),
    createSpec = require('spec-js');

function TemplaterProperty(){}
TemplaterProperty = createSpec(TemplaterProperty, Property);
TemplaterProperty.prototype.trackKeys = true;

function findValueIn(value, source){
    var isArray = Array.isArray(source);
    for(var key in source){
        if(isArray && isNaN(key)){
            continue;
        }
        if(source[key] === value){
            return key;
        }
    }
}

TemplaterProperty.prototype._immediate = true;
TemplaterProperty.prototype.watchChanges = 'structure value';
TemplaterProperty.prototype.hasChanged = function(){
    var changes = this._lastValue.update(this.value),
        watched = this.watchChanges.split(' '),
        newKeys = [],
        keysChanged;

    if(!this._lastValue._lastKeys){
        this._lastValue._lastKeys = [];
    }

    if(this._sourcePathInfo && this._sourcePathInfo.subPaths){
        for(var key in this._sourcePathInfo.subPaths){
            newKeys.push(this._sourcePathInfo.subPaths[key]);
        }

        if(
            this._lastValue._lastKeys.length !== newKeys.length
        ){
            keysChanged = true;
        }else{
            for (var i = newKeys.length - 1; i >= 0; i--) {
                if(newKeys[i] !== this._lastValue._lastKeys[i]){
                    keysChanged = true;
                    break;
                }
            }
        }

        if(keysChanged){
            changes['keys'] = true;
        }
        this._lastValue._lastKeys = newKeys;
    }

    for(var i = 0; i < watched.length; i++){
        if(changes[watched[i]]){
            return true;
        }
    }
};
TemplaterProperty.prototype.update =function (view, value) {
    if(!this.template){
        return;
    }
    this._templateCache || (this._templateCache = this.template && JSON.parse(statham.stringify(this.template)));
    this._emptyTemplateCache || (this._emptyTemplateCache = this.emptyTemplate && JSON.parse(statham.stringify(this.emptyTemplate)));
    var property = this,
        gaffa = this.gaffa,
        paths = gaffa.gedi.paths,
        viewsName = this.viewsName,
        childViews = view.views[viewsName],
        sourcePathInfo = this._sourcePathInfo,
        viewsToRemove = childViews.slice(),
        isEmpty = true;

    childViews.abortDeferredAdd();

    if (value && typeof value === "object" && sourcePathInfo){

        if(!sourcePathInfo.subPaths){
            sourcePathInfo.subPaths = new value.constructor();

            for(var key in value){
                if(Array.isArray(value) && isNaN(key)){
                    continue;
                }
                sourcePathInfo.subPaths[key] = paths.append(sourcePathInfo.path, paths.create(key));
            }
        }

        var newView,
            itemIndex = 0;

        for(var i = 0; i < childViews.length; i++){

            var childItem = childViews[i]._item;

            if(!findValueIn(childItem, value)){
                if(childViews[i].containerName === viewsName){
                    childViews[i].remove();
                    i--;
                }
            }
        }

        var remainingChildViews = childViews.slice();

        for(var key in sourcePathInfo.subPaths){
            if(Array.isArray(sourcePathInfo.subPaths) && isNaN(key)){
                continue;
            }
            isEmpty = false;
            var sourcePath = sourcePathInfo.subPaths[key],
                existingChild = null,
                existingIndex = null;

            for(var i in remainingChildViews){
                var child = remainingChildViews[i];

                if(child._item === value[key]){
                    existingChild = child;
                    existingIndex = parseInt(i);
                    delete remainingChildViews[i];
                    break;
                }
            }

            if(!existingChild){
                newView = statham.revive(this._templateCache);
                newView._item = value[key];
                newView.scope = {item: newView._item, key: key};
                newView.sourcePath = property.ignorePaths ? null : sourcePath;
                newView.containerName = viewsName;
                childViews.deferredAdd(newView, itemIndex);
            }else{
                if(existingChild.sourcePath !== sourcePath){
                    existingChild.scope = {item: existingChild._item, key: key};
                    existingChild.sourcePath = property.ignorePaths ? null : sourcePath;
                    existingChild.rebind();
                }

                if(itemIndex !== existingIndex){
                    childViews.add(existingChild, itemIndex);
                }
            }

            itemIndex++;
        }
    }

    if(isEmpty){
        for(var i = 0; i < childViews.length; i++){
            if(childViews[i].containerName === viewsName){
                childViews[i].remove();
                i--;
            }
        }
        if(this._emptyTemplateCache){
            newView = gaffa.initialiseView(statham.revive(this._emptyTemplateCache));
            newView.containerName = viewsName;
            childViews.add(newView, itemIndex);
        }
    }
};

module.exports = TemplaterProperty;