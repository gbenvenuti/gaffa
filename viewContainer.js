var createSpec = require('spec-js'),
    Bindable = require('./bindable'),
    View = require('./view'),
    initialiseViewItem = require('./initialiseViewItem'),
    removeViews = require('./removeViews'),
    arrayProto = Array.prototype;

function ViewContainer(viewContainerDescription){
    Bindable.call(this);
    var viewContainer = this;

    this._deferredViews = [];

    if(viewContainerDescription instanceof Array){
        viewContainer.add(viewContainerDescription);
    }
}
ViewContainer = createSpec(ViewContainer, Array);
for(var key in Bindable.prototype){
    ViewContainer.prototype[key] = Bindable.prototype[key];
}
ViewContainer.prototype.constructor = ViewContainer;
ViewContainer.prototype._render = true;
ViewContainer.prototype.bind = function(parent){
    Bindable.prototype.bind.apply(this, arguments);

    for(var i = 0; i < this.length; i++){
        this.add(this[i], i);
    }

    return this;
};
ViewContainer.prototype.getPath = function(){
    return getItemPath(this);
};

/*
    ViewContainers handle their own array state.
    A View that is added to a ViewContainer will
    be automatically removed from its current
    container, if it has one.
*/
ViewContainer.prototype.add = function(view, insertIndex){
    // If passed an array
    if(Array.isArray(view)){
        // Clone the array so splicing can't cause issues
        var views = view.slice();
        for(var i = 0; i < view.length; i++){
            this.add(view[i]);
        }
        return this;
    }

    if(view.parentContainer !== this || this.indexOf(view) !== insertIndex){
        if(view.parentContainer instanceof ViewContainer){
            view.parentContainer.splice(view.parentContainer.indexOf(view),1);
        }

        this.splice(insertIndex >= 0 ? insertIndex : this.length,0,view);
    }

    view.parentContainer = this;

    if(this._bound && this._render){
        if(!(view instanceof View)){
            view = this[this.indexOf(view)] = this.gaffa.initialiseView(view);
        }
        if(!view._bound){

            view.gaffa = this.parent.gaffa;

            if(!view.renderedElement){
                view.render();
                view.renderedElement.__iuid = view.__iuid;
                if(view.gaffa.debug && !(view.gaffa.browser.msie && view.gaffa.browser.version <9)){
                    view.renderedElement.viewModel = view;
                }
            }
            view.bind(this.parent, this.parent.scope);
        }
        view.insert(this, insertIndex);
    }

    return view;
};

/*
    adds 10 (10 is arbitrary) views at a time to the target viewContainer,
    then queues up another add.
*/
function executeDeferredAdd(viewContainer){
    var currentOpperation = viewContainer._deferredViews.splice(0,10);

    if(!currentOpperation.length){
        return;
    }

    for (var i = 0; i < currentOpperation.length; i++) {
        viewContainer.add(currentOpperation[i][0], currentOpperation[i][1]);
    };
    requestAnimationFrame(function(time){
        executeDeferredAdd(viewContainer);
    });
}

/*
    Adds children to the view container over time, via RAF.
    Will only begin the render cycle if there are no _deferredViews,
    because if _deferredViews.length is > 0, the render loop will
    already be going.
*/
ViewContainer.prototype.deferredAdd = function(view, insertIndex){
    var viewContainer = this,
        shouldStart = !this._deferredViews.length;

    this._deferredViews.push([view, insertIndex]);

    if(shouldStart){
        requestAnimationFrame(function(){
            executeDeferredAdd(viewContainer);
        });
    }
};

ViewContainer.prototype.abortDeferredAdd = function(){
    while(this._deferredViews.length){
        var view = this._deferredViews.pop()[0];
        if(view instanceof View && !view._bound){
            view.destroy();
        }
    }
};
ViewContainer.prototype.render = function(){
    this._render = true;
    for(var i = 0; i < this.length; i++){
        this.deferredAdd(this[i], i);
    }
};
ViewContainer.prototype.derender = function(){
    this._render = false;
    for(var i = 0; i < this.length; i++){
        var childView = this[i];

        if(childView._bound){
            childView.detach();
            childView.debind();
        }
    }
};
ViewContainer.prototype.remove = function(view){
    view.remove();
};
ViewContainer.prototype.empty = function(){
    removeViews(this);
};
ViewContainer.prototype.__serialiseExclude__ = ['element'];

module.exports = ViewContainer;