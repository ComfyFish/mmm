//=============================================================================
// Mushi Menu Maker
//
// The ultimate menu maker for RMMZ (and maybe MV someday)
// Good luck!
//
// (Detailed info is here)
//=============================================================================

const { ipcRenderer } = require('electron');
const { exists } = require('original-fs');
const ipc = ipcRenderer;
const loader = PIXI.Loader.shared;

const img_path = "assets/img/";

var input = null;
var settings = null;
var action = null;
var renderer = null;
var stage = null;
var project = null;
var panels = null;
var layers = null;
var grid = null;
var timers = null;
var ui = null;

var layer_id = 0;
var scene_num = 0;
var layer_num = 0;

function clamp(val, max, min) {
    return Math.min(Math.max(val, min), max);
}

function mouseInArea(mouse_x, mouse_y, area) {
    if (mouse_x > area.left && mouse_x < area.right) {
        if (mouse_y > area.top && mouse_y < area.bottom) {
            return true;
        }
    }
    return false;
}

function mouseInStageArea() {
    var mouse_x = input.mouse_pos.x;
    var mouse_y = input.mouse_pos.y;
    if (mouse_x < 83) { return false; }
    if (mouse_y < 80) { return false; }
    if (mouse_x > window.innerWidth - panels.getWidth() - 21) { return false; }
    return true;
}

function checkMouseOut(e, element) {
    if (e.relatedTarget == null) { return true; }
    if (e.relatedTarget == element) { return false; }
    if (e.relatedTarget.parentElement == element) { return false; }
    if (e.relatedTarget.parentElement.parentElement == element) { return false; }
    return true;
}

function normalize(val, max, min) {
    if (max-min == 0) { return 0; }
    return (val-min)/(max-min);
}

// ------------------------------------------------------------
// Setting: 
//   Class to handle global settings
//   Thought it would be nice to have them all in one
//   easy to find class, but maybe it's silly. >_<
// ------------------------------------------------------------
class settingsSystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.layer_nudge = 10;
    }
}

// ------------------------------------------------------------
// Input Manager: 
//   System to handle key presses
// ------------------------------------------------------------
class inputManager {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.key_list = [];
        this.key_ctrl = -1;
        this.key_shift = -1;
        this.registerDefaultKeys();
        this.mouse_pos = {x:0, y:0, sx:0, sy:0};
        this.click_pos = {x:0, y:0, sx:0, sy:0};
        this.store_pos = {x:0, y:0};
    }

    addKey(type, value) {
        this.key_list.push(this.registerKey(type, value));
        //console.log(this.key_list);
        return this.key_list.length - 1;
    }

    getKey(value) {
        for (var i = 0; i < this.key_list.length; i++) {
            var key = this.key_list[i];
            if (key.value == value)
                return i;
        }
    }

    registerPressFunction(value, func) {
        var index = this.getKey(value);
        this.key_list[index].press_func = function () {
            func(value);
        };
        this.key_list[index].press = () => {
            this.key_list[index].press_func();
        };
    }

    registerReleaseFunction(value, func) {
        var index = this.getKey(value);
        this.key_list[index].release_func = function () {
            func(value);
        };
        this.key_list[index].release = () => {
            this.key_list[index].release_func();
        };
    }

    registerHoldFunction(value, func) {
        var index = this.getKey(value);
        this.key_list[index].hold_func = function () {
            func(value);
        };
    }

    clearFunctions(value) {
        var key_index = this.getKey(value);
        this.key_list[key_index].press_func = undefined;
        this.key_list[key_index].release_func = undefined;
        this.key_list[key_index].hold_func = undefined;
        this.key_list[key_index].unsubscribe();
    }

    update() {
        for (var i = 0; i < this.key_list.length; i++) {
            var key = this.key_list[i];
            if (key.isDown && !key.isUp) {
                if (key.hold_func) {
                    key.hold_func(key.value);
                }
            }
        }
        this.updateMousePos();

        // Check for hover over resize handles
        // (Maybe need a better place for this)
        resizeHandleHoverCheck();
        this.processModifierKeys();
    }

    isPressed(key) {
        return this.key_list[key].isDown;
    }

    registerKey(type, value) {
        var key = {};
        key.value = value;
        key.isDown = false;
        key.isUp = true;
        key.press = undefined;
        key.release = undefined;
        key.pressfunc = undefined;
        key.releasefunc = undefined;
        key.holdfunc = undefined;


        key.downHandler = event => {
            var check;
            if (type == "keyboard") { check = event.key; } 
            else if (type == "mouse") { check = event.button; }
            if (check === key.value) {
                if (key.isUp && key.press) key.press();
                key.isDown = true;
                key.isUp = false;
                event.preventDefault();
            }
        };
      

        key.upHandler = event => {
            var check;
            if (type == "keyboard") { check = event.key; } 
            else if (type == "mouse") { check = event.button; }
            if (check === key.value) {
                if (key.isDown && key.release) key.release();
                key.isDown = false;
                key.isUp = true;
                event.preventDefault();
            }
        };
      
        // Attach event listeners
        const downListener = key.downHandler.bind(key);
        const upListener = key.upHandler.bind(key);
        
        if (type == "keyboard") {
            window.addEventListener("keydown", downListener, false);
            window.addEventListener("keyup", upListener, false);
        } else if (type == "mouse") {
            window.addEventListener("mousedown", downListener, false);
            window.addEventListener("mouseup", upListener, false);
        }
        
        // Detach event listeners
        key.unsubscribe = () => {
            if (typeof key.value === 'string' || key.value instanceof String) {
                window.removeEventListener("keydown", downListener);
                window.removeEventListener("keyup", upListener);
            } else {
                window.removeEventListener("mousedown", downListener);
                window.removeEventListener("mouseup", upListener);
            }
        };
        
        return key;
    }

    updateMousePos() {
        // Update global mouse position
        this.mouse_pos.x = renderer.plugins.interaction.mouse.global.x;
        this.mouse_pos.y = renderer.plugins.interaction.mouse.global.y;

        // Update pixi stage mouse position
        this.mouse_pos.sx = this.mouse_pos.x - stage.x;
        this.mouse_pos.sy = this.mouse_pos.y - stage.y;
    }

    updateClickPos() {
        this.click_pos.x  = this.mouse_pos.x;
        this.click_pos.y  = this.mouse_pos.y;
        this.click_pos.sx = this.mouse_pos.sx;
        this.click_pos.sy = this.mouse_pos.sy;
    }

    distanceToClick() {
        var dist = {x:0, y:0, sx:0, sy:0};
        dist.x  = this.mouse_pos.x - this.click_pos.x;
        dist.y  = this.mouse_pos.y - this.click_pos.y;
        dist.sx = this.mouse_pos.sx - this.click_pos.sx;
        dist.sy = this.mouse_pos.sy - this.click_pos.sy;
        return dist;
    }

    checkForDrag() {
        var dist = this.distanceToClick();
        return (Math.abs(dist.x) + Math.abs(dist.y) > 10);
    }

    storePos(x, y) {
        this.store_pos.x = x;
        this.store_pos.y = y;
    }

    getStoredPos() {
        return this.store_pos;
    }

    getMousePos() {
        return this.mouse_pos;
    }

    getMouseClickPos() {
        return this.click_pos;
    }

    checkMouseOut(e, element) {
        if (e.relatedTarget == null) { return true; }
        if (e.relatedTarget == element) { return false; }
        if (e.relatedTarget.parentElement == element) { return false; }
        if (e.relatedTarget.parentElement.parentElement == element) { return false; }
        return true;
    }

    processModifierKeys() {
        if (this.key_ctrl != -1) {
            if (this.isPressed(this.key_ctrl)) {
                if (!action.checkMod(MOD.CTRL)) { action.addMod(MOD.CTRL); }
            } else {
                if (action.checkMod(MOD.CTRL)) { action.removeMod(MOD.CTRL); }
            }
        }
        if (this.key_shift != -1) {
            if (this.isPressed(this.key_shift)) {
                if (!action.checkMod(MOD.SHFT)) { action.addMod(MOD.SHFT); }
            } else {
                if (action.checkMod(MOD.SHFT)) { action.removeMod(MOD.SHFT); }
            }
        }
    }

    registerDefaultKeys() {
        this.addKey("keyboard", "a");
        this.registerPressFunction("a", keyPressTest);
        //this.registerHoldFunction("a", keyPressTest);

        this.addKey("keyboard", "z");
        this.registerPressFunction("z", zPressed);

        this.addKey("keyboard", "y");
        this.registerPressFunction("y", yPressed);

        this.key_ctrl = this.addKey("keyboard", "Control");
        //this.registerPressFunction("Control", ctrlPress);
        //this.registerReleaseFunction("Control", ctrlRelease);

        this.key_shift = this.addKey("keyboard", "Shift");
        //this.registerPressFunction("Shift", shiftPress);
        //this.registerReleaseFunction("Shift", shiftRelease);

        this.key_delete = this.addKey("keyboard", "Delete");
        this.registerPressFunction("Delete", deletePress);

        this.addKey("keyboard", "ArrowLeft");
        this.registerPressFunction("ArrowLeft", arrowLeftPress);

        this.addKey("keyboard", "ArrowRight");
        this.registerPressFunction("ArrowRight", arrowRightPress);

        this.addKey("keyboard", "ArrowUp");
        this.registerPressFunction("ArrowUp", arrowUpPress);

        this.addKey("keyboard", "ArrowDown");
        this.registerPressFunction("ArrowDown", arrowDownPress);

        this.addKey("mouse", 1);
        this.registerPressFunction(1, mbMiddlePress);
        this.registerHoldFunction(1, mbMiddleHold);
        this.registerReleaseFunction(1, mbMiddleRelease);

        this.addKey("mouse", 0);
        this.registerPressFunction(0, mbLeftPress);
        this.registerHoldFunction(0, mbLeftHold);
        this.registerReleaseFunction(0, mbLeftRelease);
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Input Manager default key functions
// ------------------------------------------------------------
function resizeHandleHoverCheck() {
    if (action.noAction() && layers.selected.length > 0) {
        grid.handleHover(input.mouse_pos.x, input.mouse_pos.y);
        grid.setControlSprites();
    }
}

function keyPressTest(key) {
    console.log("Key " + key + " pressed!");
    console.log("Mouse X: " + input.mouse_pos.x + " Mouse Y: " + input.mouse_pos.y);
    //layers.getAllLayers();
}

function zPressed() {
    if (action.checkMod(MOD.CTRL)) {
        console.log("UNDO ACTION");
        action.undoAction();
    }
}

function yPressed() {
    if (action.checkMod(MOD.CTRL)) {
        console.log("REDO ACTION");
        action.redoAction();
    }
}

// Modifier keys
/*
function ctrlPress() {
    action.addMod(MOD.CTRL);
}

function ctrlRelease() {
    action.removeMod(MOD.CTRL);
}

function shiftPress() {
    action.addMod(MOD.SHFT);
}

function shiftRelease() {
    action.removeMod(MOD.SHFT);
}
*/

function deletePress() {
    // Delete me, delete me :)
    layers.deleteSelected();
}

// Nudge layers
function arrowLeftPress() {
    layers.moveSelectedLayers(-settings.layer_nudge, 0);
}

function arrowUpPress() {
    layers.moveSelectedLayers(0, -settings.layer_nudge);
}

function arrowRightPress() {
    layers.moveSelectedLayers(settings.layer_nudge, 0);
}

function arrowDownPress() {
    layers.moveSelectedLayers(0, settings.layer_nudge);
}

// Mouse functions
function mbMiddlePress() {
    if (action.noAction()) { 
        action.setAction("pan_viewport");
        input.updateClickPos();
        input.storePos(stage.x, stage.y);
    }
}

function mbMiddleHold() {
    if (action.checkAction("pan_viewport")) {
        var dist = input.distanceToClick();
        stage.x = input.store_pos.x + dist.x;
        stage.y = input.store_pos.y + dist.y;
    }
}

function mbMiddleRelease() {
    action.clearAction();
}

function mbLeftPress() {
    input.updateClickPos();
    // Use draw tool to make window
    if (action.checkTool("draw_tool")) {
        if (!mouseInStageArea()) { return; }
        action.setAction("window_draw");
        var win_layer = layers.newWindowLayer();
        action.addObj({type:"win_create", layer:win_layer, win:win_layer.render_object, x:0, y:0, w:0, h:0});
        win_layer.render_object.move(input.mouse_pos.sx, input.mouse_pos.sy);
    }

    // Move tool functions
    if (action.checkTool("move_tool")) {
        if (!mouseInStageArea()) { return; }
        // Object resize
        if (grid.handle_hover != -1) {
            action.setAction("object_resize");
            grid.storeBoundsFromHandle();
            return;
        }

        // General moving functions
        var obj = layers.mouseInObject(input.mouse_pos.x, input.mouse_pos.y);
        if (obj) {
            if (action.checkMod(MOD.CTRL) || action.checkMod(MOD.SHFT)) {
                layers.toggleSelect(obj.parent_layer);
            } else {
                if (!obj.parent_layer.selected()) {
                    layers.select(obj.parent_layer);
                    panels.scrollToLayer(obj.parent_layer);
                }
                if (obj.parent_layer.selected()) {
                    for (var i = 0; i < layers.selected.length; i++) {
                        var win = layers.selected[i].render_object;
                        win.setMouseOffset();
                    }
                    action.setAction("object_move");
                }
            }
        } else {
            layers.deselectAllLayers();
            grid.refreshSelection();
            action.setAction("selection_box");
        }
    }
}

function mbLeftHold() {
    var dist = input.distanceToClick();
    if (input.checkForDrag()) { mouseDragStart(); }
    if (action.dragging) { mouseDrag(); }

    if (action.checkAction("resize_panels_v")) {
        var panel_size = input.getStoredPos();
        var nw = clamp(panel_size.x - dist.x, window.innerWidth/2, 200);
        panels.resizeWidth(nw);
    }
    if (action.checkAction("resize_panels_h")) {
        var panel_size = input.getStoredPos();
        var nh = clamp(panel_size.y + dist.y, window.innerHeight-327, 155);
        panels.resizeHeight(nh);
    }
    if (action.checkAction("window_draw")) {
        var cp = input.getMouseClickPos();
        var mp = input.getMousePos();
        var mz_win = action.getObj().win;
        if (mz_win) {
            var diff_x = mp.sx - cp.sx;
            var diff_y = mp.sy - cp.sy;
            if (diff_x < 0) {
                mz_win.move(mp.sx, mz_win.y);
                diff_x = Math.abs(diff_x);
            }
            if (diff_y < 0) {
                mz_win.move(mz_win.x, mp.sy);
                diff_y = Math.abs(diff_y);
            }
            mz_win.resize(diff_x, diff_y);
            grid.refreshSelection();
        }
    }
    if (action.checkAction("selection_box")) {
        // Selection box to select multiple windows
        var x1 = input.click_pos.sx;
        var y1 = input.click_pos.sy;
        var x2 = input.mouse_pos.sx;
        var y2 = input.mouse_pos.sy;
        grid.drawDragSelection(x1, y1, x2, y2);
        layers.deselectAllLayers();
        var window_selection = layers.windowsInBox(x1, y1, x2, y2);
        for (var i = 0; i < window_selection.length; i++) {
            var layer = window_selection[i].parent_layer;
            if (i == 0) { panels.scrollToLayer(layer); }
            if (!layer.selected()) { layers.toggleSelect(layer); }
        }
        grid.refreshSelection();
    }
    if (action.checkAction("object_resize")) {
        grid.resizeSelection();
    }
}

function mouseDragStart() {
    if (action.dragging) { return; }
    // Stuff here
    console.log("Started dragging.");
    action.dragging = true;
}

function mouseDrag() {
    if (action.checkAction("object_move")) {
        var mp = input.getMousePos();
        for (var i = 0; i < layers.selected.length; i++) {
            var obj = layers.selected[i].render_object;
            obj.move(mp.sx - obj.off_x, mp.sy - obj.off_y);
        }
        grid.refreshSelection();
    }
}

function mbLeftRelease() {
    if (action.checkAction("resize_panels_h")) {
        ui.setAnim(panels.layer_panel, "height 0.2s ease-out");
        ui.setAnim(panels.prop_panel, "height 0.2s ease-out");
        ui.setAnim(panels.btn_new_group, "height 0.2s ease-out");
        ui.setAnim(panels.btn_new_scene, "height 0.2s ease-out");
        ui.setAnim(panels.btn_delete_layer, "height 0.2s ease-out");
    }
    if (action.checkAction("window_draw")) {
        // Update the size of the window in action history for proper undo/redo
        var mz_win = action.getObj().win;
        if (mz_win.height < 20 || mz_win.width < 20) {
            layers.removeLayer(mz_win.parent_layer);
            layers.deselectAllLayers();
            grid.refreshSelection();
            layer_id -= 1;
            window_layer_num -= 1;
        } else {
            action.getObj().x = mz_win.x;
            action.getObj().y = mz_win.y;
            action.getObj().w = mz_win.width;
            action.getObj().h = mz_win.height;
            action.storeAction();
            //console.log(action.getObj());
        }
    }
    if (action.checkAction("selection_box")) {
        grid.clearDragSelection();
    }
    action.dragging = false;
    action.clearAction();
    grid.refreshSelection();
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Action System: 
//   Handles interactive actions, tools, and history states
// ------------------------------------------------------------
const MOD = {
    NONE: 0,
    CTRL: 1,
    SHFT: 2
};

class actionSystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.action    = {name:"", store:false, obj:null};
        this.tool      = null;
        this.mod_flags = MOD.NONE;
        this.dragging  = false;
        this.history   = [];
        this.redo      = [];
    }

    setAction(action) {
        if (this.action.name != "") {
            this.clearAction();
        }
        this.action.name = action;
    }

    storeAction() {
        this.action.store = true;
    }

    checkAction(action) {
        return this.action.name == action;
    }

    addObj(obj) {
        this.action.obj = obj;
    }

    clearAction() {
        if (this.action.name != "" && this.action.store) {
            this.history.push(this.action);
            this.redo = [];
        }
        this.action = {name:"", store:false, obj:null};
    }

    noAction() {
        return this.action.name == "";
    }

    setTool(tool) {
        this.tool = tool;
    }

    checkTool(tool) {
        return this.tool == tool;
    }

    getObj() {
        return this.action.obj;
    }

    clearTool() {
        this.tool = null
    }

    addMod(mod) {
        this.mod_flags |= mod;
    }
    removeMod(mod) {
        this.mod_flags &= ~mod;
    }

    checkMod(mod) {
        return (this.mod_flags & mod) === mod;
    }

    undoAction() {
        if (this.history.length > 0) {
            var act = this.history.pop();
            this.redo.push(act);

            if (act.name == "window_draw") {
                var obj = act.obj;
                layers.removeLayer(obj.layer);
                layers.deselectAllLayers();
                grid.refreshSelection();
                layer_id -= 1;
                window_layer_num -= 1;
            }
        }
    }

    redoAction() {
        if (this.redo.length > 0) {
            var act = this.redo.pop();
            //console.log(this.history);

            if (act.name == "window_draw") {
                var obj = act.obj;
                var win_layer = layers.newWindowLayer();
                win_layer.render_object.move(obj.x, obj.y);
                win_layer.render_object.resize(obj.w, obj.h);
                act.obj.layer = win_layer;
                act.obj.win = win_layer.render_object;
            }

            this.history.push(act);
        }
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Grid System: 
//   Pixi-related rendering of the grid and various selection
//   control handles in pixi
//
//   Selection handles are generated like this:
//   0 1 2
//   3   4
//   5 6 7
// ------------------------------------------------------------

class gridSystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.divs = 13;
        this.margin_h = 0;
        this.margin_v = 0;

        this.grid = new PIXI.Graphics();
        stage.addChild(this.grid);
        this.drawGrid();

        this.selection_margin = 0;
        this.selection = new PIXI.Graphics();
        this.selection.zIndex = 9;
        stage.addChild(this.selection);

        this.drag_selection = new PIXI.Graphics();
        stage.addChild(this.drag_selection);
        this.selection_bounds = { x1: 0, y1: 0, x2: 0, y2: 0 };
        this.reference_bounds = { x1: 0, y1: 0, x2: 0, y2: 0 };

        this.handle = [];
        this.handle_hover = -1;
        this.handle_offset = {x: 0, y: 0};
        this.guide = [];
        this.guides = new PIXI.Graphics();
        stage.addChild(this.guides);
    }

    createControlSprites() {
        for (var i = 0; i < 8; i++) {
            //console.log(sprite_sheet);
            this.handle[i] = new PIXI.Sprite(sprite_sheet.textures["stage-control-handle.png"]);
            this.handle[i].visible = false;
            this.handle[i].anchor.set(0.5);
            this.handle[i].scale.set(0.3);
            this.handle[i].zIndex = 10;
            stage.addChild(this.handle[i]);
        }
    }

    setControlSprites() {
        for (var i = 0; i < 8; i++) {
            if (i == this.handle_hover) {
                this.handle[i].texture = sprite_sheet.textures["stage-control-handle-hover.png"];
            } else {
                this.handle[i].texture = sprite_sheet.textures["stage-control-handle.png"];
            }
        }
    }

    clearHandles() {
        for (var i = 0; i < 8; i++) {
            this.handle[i].visible = false;
        }
    }

    drawGrid() {
        // Draw the margin box
        if (this.margin_h > 0 || this.margin_v > 0) {
            var mh = this.margin_h / 2;
            var mv = this.margin_v / 2;
            this.grid.lineStyle(1, 0x1a1d2e);
            this.grid.drawRect(mh, mv, project.width - this.margin_h, project.height - this.margin_v);
        }

        // Box around the project area
        this.grid.clear();
        this.grid.lineStyle(2, 0x333a4c);
        this.grid.drawRect(0, 0, project.width, project.height);

        // Draw vertical lines
        this.grid.lineStyle(1, 0x1a1d2e);
        var inc = 0;
        var divs_v = Math.round((project.width / project.height) * this.divs);
        for (var i = 1; i < divs_v; i++) {
            inc = project.width / divs_v;
            this.grid.moveTo(inc * i, 0);
            this.grid.lineTo(inc * i, project.height);
        }
        // Draw horizontal lines
        for (i = 1; i < this.divs; i++) {
            inc = project.height / this.divs;
            this.grid.moveTo(0, inc * i);
            this.grid.lineTo(project.width, inc * i);
        }
    }

    drawGuides() {
        this.guides.clear();
        this.guides.lineStyle(1, 0xff3466);
        for (var i = 0; i < this.guide.length; i++) {
            this.guide[i].selected ? this.guides.lineStyle(1, 0xe2e8f0) : this.guides.lineStyle(1, 0xff3466);
            if (this.guide[i].type == "horizontal") {
                this.guides.moveTo(-10000, this.guide[i].y);
                this.guides.lineTo(10000, this.guide[i].y);
            }
            if (this.guide[i].type == "vertical") {
                this.guides.moveTo(this.guide[i].x, -10000);
                this.guides.lineTo(this.guide[i].x, 10000);
            }
        }
    }

    drawSelection() {
        if (!sprite_sheet_loaded) { return; }
        this.selection.clear();
        this.clearHandles();
        //this.setControlSprites();
        if (layers.selected.length == 0) { return; }
        if (action.checkAction("window_draw")) { return; }

        // Get the bounding box of all the selections
        this.getSelectionBounds();
        var x1, y1, x2, y2;
        x1 = this.selection_bounds.x1;
        y1 = this.selection_bounds.y1;
        x2 = this.selection_bounds.x2;
        y2 = this.selection_bounds.y2;

        this.selection.lineStyle(1, 0x6c7a8c);
        this.selection.drawRect(x1, y1, x2 - x1, y2 - y1);
        this.drawHandles(x1, y1, x2, y2);
    }

    getSelectionBounds() {
        var x1, y1, x2, y2;
        for (var i = 0; i < layers.selected.length; i++) {
            var obj = layers.selected[i].render_object;
            if (i == 0) { x1 = obj.x; y1 = obj.y; x2 = obj.x + obj.width; y2 = obj.y + obj.height; }
            else {
                if (obj.x < x1) { x1 = obj.x; }
                if (obj.y < y1) { y1 = obj.y; }
                if (obj.x + obj.width > x2) { x2 = obj.x + obj.width; }
                if (obj.y + obj.height > y2) { y2 = obj.y + obj.height; }
            }
        }
        this.selection_bounds.x1 = x1;
        this.selection_bounds.y1 = y1;
        this.selection_bounds.x2 = x2;
        this.selection_bounds.y2 = y2;
    }

    drawHandles(x1, y1, x2, y2) {
        var h = y2 - y1;
        var w = x2 - x1;
        var j = 0;
        var k = 0;
        for (var i = 0; i < this.handle.length; i++) {
            if (j == 1 && k == 1) { j++; }
            this.handle[i].position.x = x1 + j * (w / 2);
            this.handle[i].position.y = y1 + k * (h / 2);
            this.handle[i].visible = true;
            if (j < 2) { j++; } else { j = 0; k += 1; }
        }
    }

    handleHover(mouse_x, mouse_y) {
        for (var i = 0; i < this.handle.length; i++) {
            if (Math.abs(mouse_x - stage.x - this.handle[i].position.x) < 15 && Math.abs(mouse_y - stage.y - this.handle[i].position.y) < 15) {
                this.handle_hover = i;
                return i;
            }
        }
        this.handle_hover = -1;
        return -1;
    }

    storeBoundsFromHandle() {
        this.reference_bounds.x1 = this.handle[this.handle_hover].position.x;
        this.reference_bounds.y1 = this.handle[this.handle_hover].position.y;
        this.reference_bounds.x2 = this.handle[7-this.handle_hover].position.x;
        this.reference_bounds.y2 = this.handle[7-this.handle_hover].position.y;

        this.handle_offset.x = input.mouse_pos.sx - this.reference_bounds.x1;
        this.handle_offset.y = input.mouse_pos.sy - this.reference_bounds.y1;

        for (var i = 0; i < layers.selected.length; i++) {
            var obj = layers.selected[i].render_object;
            obj.store.x = obj.x;
            obj.store.y = obj.y;
            obj.store.w = obj.width;
            obj.store.h = obj.height;
        }
    }

    resizeSelection() {
        var dist = input.distanceToClick();
        var bx, by, bw, bh, sx1, sy1, sx2, sy2, dist_x, dist_y;
        bx = this.reference_bounds.x1;
        by = this.reference_bounds.y1;
        bw = this.reference_bounds.x2 - bx;
        bh = this.reference_bounds.y2 - by;

        dist_x = dist.sx;
        dist_y = dist.sy;

        for (var i = 0; i < layers.selected.length; i++) {
            var obj = layers.selected[i].render_object;

            sx1 = normalize(obj.store.x, bx, bx+bw);
            sy1 = normalize(obj.store.y, by, by+bh);
            sx2 = normalize(obj.store.x + obj.store.w, bx, bx+bw);
            sy2 = normalize(obj.store.y + obj.store.h, by, by+bh);

            var x1 = obj.store.x + dist_x * sx1;
            var y1 = obj.store.y + dist_y * sy1;
            var x2 = obj.store.x + obj.store.w + (dist_x * sx2);
            var y2 = obj.store.y + obj.store.h + (dist_y * sy2);

            var nx = x1;
            var ny = y1;
            var nw = x2 - x1;
            var nh = y2 - y1;
            if (nw < 0) { nx = x2; nw = Math.abs(nw); }
            if (nh < 0) { ny = y2; nh = Math.abs(nh); }

            obj.move(nx, ny);
            obj.resize(nw, nh);
        }

        this.refreshSelection();
    }

    refresh() {
        this.drawGrid();
        this.drawSelection();
    }

    refreshSelection() {
        this.drawSelection();
    }

    drawDragSelection(x1, y1, x2, y2) {
        this.drag_selection.clear();
        this.drag_selection.lineStyle(2, 0xff3466);
        this.drag_selection.drawRect(x1, y1, x2 - x1, y2 - y1);
    }

    clearDragSelection() {
        this.drag_selection.clear();
    }

    newGuide(type) {
        this.deselectAllGuides();

        var g = {};
        g.type = type;
        g.x = 0;
        g.y = 0;
        g.selected = true;

        this.guide.push(g);
        this.drawGuides();

        return this.guide.length - 1;
    }

    moveGuide(index, xx, yy) {
        this.guide[index].x = xx;
        this.guide[index].y = yy;
    }

    selectGuide(index) {
        if (layers.selected.length > 0) {
            layers.deselectAllLayers();
        }
        this.guide[index].selected = true;
    }

    findGuideIndex(guide) {
        for (var i = 0; i < this.guide.length; i++) {
            if (guide == this.guide[i]) { return i; }
        }

        return null;
    }

    deleteSelectedGuides() {
        for (var i = 0; i < this.guide.length; i++) {
            var g = this.guide[i];
            if (g.selected) {
                this.guide.splice(i, 1);
                i -= 1;
            }
        }
        this.drawGuides();
    }

    deselectAllGuides() {
        for (var i = 0; i < this.guide.length; i++) {
            this.guide[i].selected = false;
        }
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Project System: 
//   Handles project-wide settings and data
// ------------------------------------------------------------
class projectSystem {
    constructor() {
        this.initialize(...arguments);
    }
    initialize() {
        this.name = "New Project";
        this.width = 816;
        this.height = 624;
    }
    setSize(w, h) {
        this.width = w;
        this.height = h;
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Property System:
//   Handles properties of MZ windows, images, shapes, etc.
// ------------------------------------------------------------
class propertySystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.properties = [];
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Timer System:
//   What do I use this for??
// ------------------------------------------------------------
class timerSystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.timers = [];

        var scrollTimerDuring = function () {
            panels.scrollLayers(100000);
        };
        this.scroll_timer = this.newTimer(scrollTimerDuring, null);
    }

    newTimer(during_func, end_func) {
        var timer = {};
        timer.during = during_func;
        timer.end = end_func;
        timer.time = 0;
        this.timers.push(timer);
        return this.timers.length - 1;
    }

    setTimer(timer, time) {
        this.timers[timer].time = time;
    }

    update() {
        for (var i = 0; i < this.timers.length; i++) {
            var timer = this.timers[i];
            if (timer.time > 0) {
                if (timer.time - 1 == 0) { if (timer.end) { timer.end(); } }
                else if (timer.during) { timer.during(); }
                timer.time -= 1;
            }
        }
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// UI System:
//   Helper class for making UIs and stuff
// ------------------------------------------------------------
const btn = {
    ele: 0,
    img: 1,
    alt: 2,
    prs: 3,
    tgl: 4,
    swp: 5,
    grp: 6,
    fnc: 7,
    hvr: 8
};
class UISystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.element = [];
        this.button = [];
    }

    createElement(name, parent, type) {
        var element = document.createElement(type);
        element.setAttribute("id", name);
        element.setAttribute("draggable", false);
        parent.appendChild(element);
        var id = this.element.push(element) - 1;
        this.styleDefault(id);
        return id;
    }

    getElement(element) {
        return this.element[element];
    }

    findElement(name) {
        return document.getElementById(name);
    }

    setPos(element, border_x, pos_x, border_y, pos_y) {
        switch (border_x) {
            case "left":
                this.element[element].style.left = pos_x;
                break;
            case "right":
                this.element[element].style.right = pos_x;
                break;
        }
        switch (border_y) {
            case "top":
                this.element[element].style.top = pos_y;
                break;
            case "bottom":
                this.element[element].style.bottom = pos_y;
                break;
        }
    }

    setSize(element, width, height) {
        this.element[element].style.width = width;
        this.element[element].style.height = height;
    }

    setWindowDragRegion(element) {
        this.element[element].style.webkitAppRegion = "drag";
    }

    setColor(element, color) {
        this.element[element].style.backgroundColor = color;
    }

    styleDefault(element) {
        this.element[element].style.position = "absolute";
        this.element[element].style["-webkit-user-select"] = "none";
        this.element[element].style["-webkit-app-region"] = "no-drag";
    }

    setImage(element, path) {
        this.element[element].src = img_path + path;
    }

    setImageHover(element, path) {
        this.element[element].src = img_path + path.split(".")[0] + "-hover.svg";
    }

    setImageSelected(element, path) {
        this.element[element].src = img_path + path.split(".")[0] + "-selected.svg";
    }

    setBgColor(element, color) {
        this.element[element].style.backgroundColor = color;
    }

    setBorderRadius(element, radius) {
        this.element[element].style.borderRadius = radius;
    }

    setScroll(element, scroll) {
        if (scroll) {
            this.element[element].style.overflow = "hidden";
        } else {
            this.element[element].style.overflow = "visible";
        }
    }

    setAnim(element, anim) {
        this.element[element].style.transition = anim;
    }

    setPanelStyle(element) {
        this.setBgColor(element, "#1a1d2e")
        this.setBorderRadius(element, "10px");
        this.setScroll(element, true);
        this.setAnim(element, "height 0.2s ease-out");
    }

    setLayerStyle(element) {
        //this.setBgColor(element, "#1a1d2e");
        this.element[element].style.position = "relative";
        this.element[element].style.overflow = "hidden";
        this.element[element].style.transition = "height 0.1s ease-out";
    }

    addText(element, text, font, font_size, color) {
        this.element[element].innerText = text;
        this.element[element].style.fontFamily = font;
        this.element[element].style.fontSize = font_size;
        this.element[element].style.color = color;
    }

    hide(element) {
        this.element[element].style.visibility = "hidden";
    }

    unhide(element) {
        this.element[element].style.visibility = "visible";
    }

    makeButton(element, click_function) {
        var button = [];
        button[btn.ele] = element;
        button[btn.img] = this.element[element].src;
        button[btn.iel] = this.element[element];
        button[btn.alt] = null;
        button[btn.hvr] = false;
        button[btn.prs] = false;
        button[btn.tgl] = false;
        button[btn.swp] = false;
        button[btn.grp] = 0;
        button[btn.fnc] = click_function;

        this.element[element].onmouseover = function (e) {
            button[btn.hvr] = true;
            ui.updateButton(element);
            this.style.cursor = 'pointer';
        };

        this.element[element].onmouseout = function (e) {
            button[btn.hvr] = false;
            ui.updateButton(element);
            this.style.cursor = 'default';
        };

        this.element[element].onclick = function (e) {
            ui.pressButton(element);
            //if (click_function) {click_function();}
        };

        this.button.push(button);
    }

    updateButton(element) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        if (this.button[button][btn.prs] == false) {
            if (this.button[button][btn.swp] == false) {
                if (this.button[button][btn.hvr] == false) {
                    this.button[button][btn.iel].src = this.button[button][btn.img];
                } else {
                    this.button[button][btn.iel].src = this.button[button][btn.img].split(".")[0] + "-hover.svg";
                }
            } else {
                if (this.button[button][btn.hvr] == false) {
                    this.button[button][btn.iel].src = this.button[button][btn.alt];
                } else {
                    this.button[button][btn.iel].src = this.button[button][btn.alt].split(".")[0] + "-hover.svg";
                }
            }
        } else {
            if (this.button[button][btn.swp] == false) {
                this.button[button][btn.iel].src = this.button[button][btn.img].split(".")[0] + "-selected.svg";
            } else {
                this.button[button][btn.iel].src = this.button[button][btn.alt].split(".")[0] + "-selected.svg";
            }
        }
    }

    findButton(element) {
        var found = -1;
        for (var i = 0; i < this.button.length; i++) {
            if (this.button[i][btn.ele] == element) {
                found = i;
                break;
            }
        }
        return found;
    }

    pressButton(element) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        var group = this.button[button][btn.grp];
        if (group || this.button[button][btn.tgl]) {
            this.unpressGroup(group);
            this.button[button][btn.prs] = true;
            this.updateButton(element);
        }
        var button_function = this.button[button][btn.fnc];
        if (button_function) { button_function(); }
    }

    unpressButton(element) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        this.button[button][btn.prs] = false;
        this.updateButton(element);
    }

    setButtonGroup(element, group) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        this.button[button][btn.grp] = group;
    }

    unpressGroup(group) {
        if (group) {
            for (var i = 0; i < this.button.length; i++) {
                if (this.button[i][btn.grp] == group) {
                    this.unpressButton(this.button[i][btn.ele]);
                }
            }
        }
    }

    setButtonImage(element, img_element) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        this.button[button][btn.iel] = this.element[img_element];
        this.button[button][btn.img] = this.element[img_element].src;
    }

    changeButtonImage(element, img) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        this.button[button][btn.img] = img_path + img;
        //this.button[button][btn.alt] = img_path + alt;
        this.updateButton(element);
    }

    setButtonAlt(element, img) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        this.button[button][btn.alt] = img_path + img;
    }

    changeButtonAlt(element, img) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        //this.button[button][btn.img] = img_path + img;
        this.button[button][btn.alt] = img_path + img;
        this.updateButton(element);
    }

    buttonSwitch(element) {
        var button = this.findButton(element);
        if (button == -1) { return; }
        this.button[button][btn.swp] = !this.button[button][btn.swp];
        this.updateButton(element);
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Panel System:
//   Manages layer panel and properties panel, 
//   and their functions
// ------------------------------------------------------------
class panelSystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.width = 300;
        this.height = 400;

        this.layer_panel = null;
        this.layer_panel_content = null;
        this.prop_panel = null;
        this.prop_panel_content = null;

        this.grabby_v = null;
        this.grabby_h = null;

        this.btn_layer_panel = null;
        this.btn_prop_panel = null;
        this.btn_new_group = null;
        this.btn_new_scene = null;
        this.btn_delete_layer = null;

        this.lp_content_container = null;
        this.pp_content_container = null;
        this.lp_content_wrapper = null;
        this.pp_content_wrapper = null;

        this.layer_panel_open = true;
        this.prop_panel_open = true;

        this.memorized_height = 0;

        this.createUI();
    }

    createUI() {
        // Layer panel
        this.layer_panel = ui.createElement("layer_panel", document.body, "div");
        ui.setPos(this.layer_panel, "right", "26px", "top", "86px");
        ui.setSize(this.layer_panel, this.width + "px", this.height + "px");
        ui.setPanelStyle(this.layer_panel);

        var layer_panel_title = ui.createElement("lp_title", ui.getElement(this.layer_panel), "div");
        ui.setPos(layer_panel_title, "left", "24px", "top", "20px");
        ui.addText(layer_panel_title, "LAYERS", "RBold", "14pt", "#a0aec0");

        this.btn_layer_panel = ui.createElement("btn_layer_panel", ui.getElement(this.layer_panel), "div");
        ui.setPos(this.btn_layer_panel, "right", "0px", "top", "0px");
        ui.setSize(this.btn_layer_panel, this.width + "px", "58px");
        ui.makeButton(this.btn_layer_panel, this.toggleLayerPanel);

        var layer_dropdown = ui.createElement("layer_dropdown", ui.getElement(this.btn_layer_panel), "img");
        ui.setPos(layer_dropdown, "right", "20px", "top", "20px");
        ui.setSize(layer_dropdown, "20px", "20px");
        ui.setImage(layer_dropdown, "layers-title-open.svg");
        ui.setButtonImage(this.btn_layer_panel, layer_dropdown);
        ui.setButtonAlt(this.btn_layer_panel, "layers-title-closed.svg");

        // Layer panel content
        this.layer_panel_content = ui.createElement("lp_content", ui.getElement(this.layer_panel), "div");
        ui.setPos(this.layer_panel_content, "left", "0px", "top", "58px");
        ui.setSize(this.layer_panel_content, "100%", this.height - 58 - 49 + "px");
        new SimpleBar(ui.getElement(this.layer_panel_content));
        this.lp_content_container = document.getElementsByClassName("simplebar-content")[0];
        this.lp_content_wrapper = document.getElementsByClassName("simplebar-content-wrapper")[0];
        //console.log(this.lp_content_container);

        // Bottom Buttons
        this.btn_new_group = ui.createElement("btn_new_group", ui.getElement(this.layer_panel), "img");
        ui.setPos(this.btn_new_group, "left", "14px", "top", this.height - 40 + "px");
        ui.setSize(this.btn_new_group, "28px", "28px");
        ui.setImage(this.btn_new_group, "layers-new-group.svg");
        ui.makeButton(this.btn_new_group, null);

        this.btn_new_scene = ui.createElement("btn_new_scene", ui.getElement(this.layer_panel), "img");
        ui.setPos(this.btn_new_scene, "left", "46px", "top", this.height - 40 + "px");
        ui.setSize(this.btn_new_scene, "28px", "28px");
        ui.setImage(this.btn_new_scene, "layers-new-scene.svg");
        ui.makeButton(this.btn_new_scene, this.newSceneButton);

        this.btn_delete_layer = ui.createElement("btn_delete", ui.getElement(this.layer_panel), "img");
        ui.setPos(this.btn_delete_layer, "right", "14px", "top", this.height - 40 + "px");
        ui.setSize(this.btn_delete_layer, "28px", "28px");
        ui.setImage(this.btn_delete_layer, "layers-delete.svg");
        ui.makeButton(this.btn_delete_layer, null);

        // Properties panel
        var wh = window.innerHeight;
        this.prop_panel = ui.createElement("prop_panel", document.body, "div");
        ui.setPos(this.prop_panel, "right", "26px", "bottom", "68px");
        ui.setSize(this.prop_panel, this.width + "px", wh - this.height - 172 + "px");
        ui.setPanelStyle(this.prop_panel);

        var prop_panel_title = ui.createElement("pp_title", ui.getElement(this.prop_panel), "div");
        ui.setPos(prop_panel_title, "left", "24px", "top", "20px");
        ui.addText(prop_panel_title, "PROPERTIES", "RBold", "14pt", "#a0aec0");

        this.btn_prop_panel = ui.createElement("btn_prop_panel", ui.getElement(this.prop_panel), "div");
        ui.setPos(this.btn_prop_panel, "right", "0px", "top", "0px");
        ui.setSize(this.btn_prop_panel, this.width + "px", "58px");
        ui.makeButton(this.btn_prop_panel, this.togglePropPanel);

        var prop_dropdown = ui.createElement("prop_dropdown", ui.getElement(this.btn_prop_panel), "img");
        ui.setPos(prop_dropdown, "right", "20px", "top", "20px");
        ui.setSize(prop_dropdown, "20px", "20px");
        ui.setImage(prop_dropdown, "layers-title-open.svg");
        ui.setButtonImage(this.btn_prop_panel, prop_dropdown);
        ui.setButtonAlt(this.btn_prop_panel, "layers-title-closed.svg");

        // Properties panel content
        this.prop_panel_content = ui.createElement("lp_content", ui.getElement(this.prop_panel), "div");
        ui.setPos(this.prop_panel_content, "left", "0px", "top", "58px");
        ui.setSize(this.prop_panel_content, "100%", wh - this.height - 172 - 58 + "px");
        new SimpleBar(ui.getElement(this.prop_panel_content));
        this.pp_content_container = document.getElementsByClassName("simplebar-content")[1];
        this.pp_content_wrapper = document.getElementsByClassName("simplebar-content-wrapper")[1];

        // Grabbies
        this.grabby_v = ui.createElement("grabby_v", document.body, "div");
        ui.setPos(this.grabby_v, "right", 24 + this.width + "px", "top", "95px");
        ui.setSize(this.grabby_v, "20px", "79.5%");
        var grabby_v_line = ui.createElement("grabby_v_line", ui.getElement(this.grabby_v), "div");
        ui.setPos(grabby_v_line, "left", "50%", "top", "0px");
        ui.setSize(grabby_v_line, "1px", "100%");
        ui.setBgColor(grabby_v_line, "#3b3e51");
        ui.setAnim(grabby_v_line, "opacity 0.1s ease-out");
        ui.getElement(grabby_v_line).style.opacity = 0;

        ui.getElement(this.grabby_v).onmouseover = function(e) {
            ui.getElement(grabby_v_line).style.opacity = 0.25;
            this.style.cursor = 'ew-resize';
        }
        ui.getElement(this.grabby_v).onmouseout = function(e) {
            ui.getElement(grabby_v_line).style.opacity = 0;
            this.style.cursor = 'default';
        }
        ui.getElement(this.grabby_v).onmousedown = function(e) {
            input.storePos(panels.width, panels.height);
            action.setAction("resize_panels_v");
        }

        this.grabby_h = ui.createElement("grabby_h", document.body, "div");
        ui.setPos(this.grabby_h, "right", "26px", "top", this.height + 85 + "px");
        ui.setSize(this.grabby_h, this.width + "px", "20px");
        var grabby_h_line = ui.createElement("grabby_h_line", ui.getElement(this.grabby_h), "div");
        ui.setPos(grabby_h_line, "left", "0px", "top", "50%");
        ui.setSize(grabby_h_line, "100%", "1px");
        ui.setBgColor(grabby_h_line, "#3b3e51");
        ui.setAnim(grabby_h_line, "opacity 0.1s ease-out");
        ui.getElement(grabby_h_line).style.opacity = 0;

        ui.getElement(this.grabby_h).onmouseover = function(e) {
            ui.getElement(grabby_h_line).style.opacity = 0.25;
            this.style.cursor = 'ns-resize';
        }
        ui.getElement(this.grabby_h).onmouseout = function(e) {
            ui.getElement(grabby_h_line).style.opacity = 0;
            this.style.cursor = 'default';
        }
        ui.getElement(this.grabby_h).onmousedown = function(e) {
            input.storePos(panels.width, panels.height);
            action.setAction("resize_panels_h");
            panels.openLayerPanel();
            panels.openPropPanel();
            ui.setAnim(panels.layer_panel, "height 0s ease-out");
            ui.setAnim(panels.prop_panel, "height 0s ease-out");
            ui.setAnim(panels.btn_new_group, "height 0s ease-out");
            ui.setAnim(panels.btn_new_scene, "height 0s ease-out");
            ui.setAnim(panels.btn_delete_layer, "height 0s ease-out");
        }
    }

    resizeHeight(nh) {
        this.height = nh;
        ui.getElement(this.layer_panel).style.height = nh + "px";
        ui.getElement(this.prop_panel).style.height = window.innerHeight - nh - 172 + "px";
        ui.getElement(this.grabby_h).style.top = nh + 85 + "px";
        ui.getElement(this.layer_panel_content).style.height = nh - 58 - 49 + "px";
        ui.getElement(this.prop_panel_content).style.height = window.innerHeight - nh - 172 - 58 + "px";
        ui.getElement(this.btn_new_group).style.top = nh - 40 + "px";
        ui.getElement(this.btn_new_scene).style.top = nh - 40 + "px";
        ui.getElement(this.btn_delete_layer).style.top = nh - 40 + "px";
    }

    resizeWidth(nw) {
        this.width = nw;
        ui.getElement(this.layer_panel).style.width = nw + "px";
        ui.getElement(this.prop_panel).style.width = nw + "px";
        ui.getElement(this.grabby_v).style.right = nw + 24 + "px";
        ui.getElement(this.grabby_h).style.width = nw + "px";
    }

    getWidth() {
        return this.width + 24;
    }

    getRatio() {
        return ui.getElement(this.layer_panel).style.height / ui.getElement(this.prop_panel).style.height;
    }

    hideLayerButtons() {
        ui.getElement(this.btn_new_scene).style.visibility = "hidden";
        ui.getElement(this.btn_new_group).style.visibility = "hidden";
        ui.getElement(this.btn_delete_layer).style.visibility = "hidden";
    }

    unhideLayerButtons() {
        ui.getElement(this.btn_new_scene).style.visibility = "visible";
        ui.getElement(this.btn_new_group).style.visibility = "visible";
        ui.getElement(this.btn_delete_layer).style.visibility = "visible";
    }

    toggleLayerPanel() {
        ui.setAnim(panels.layer_panel, "height 0.2s ease-out");
        ui.setAnim(panels.prop_panel, "height 0.2s ease-out");
        if (panels.layer_panel_open) {
            panels.closeLayerPanel();
        } else {
            panels.openLayerPanel();
            panels.resizeHeight(155);
        }
    }

    togglePropPanel() {
        ui.setAnim(panels.layer_panel, "height 0.2s ease-out");
        ui.setAnim(panels.prop_panel, "height 0.2s ease-out");
        if (panels.prop_panel_open) {
            panels.closePropPanel();
        } else {
            panels.openPropPanel();
            panels.resizeHeight(window.innerHeight-327);
        }
    }

    closeLayerPanel() {
        if (this.layer_panel_open) {
            this.layer_panel_open = false;
            this.resizeHeight(58);
            this.hideLayerButtons();
            ui.buttonSwitch(this.btn_layer_panel);
        }
        if (!this.prop_panel_open) {
            this.memorized_height = 0;
            this.openPropPanel();
        }
    }

    openLayerPanel() {
        if (!this.layer_panel_open) {
            this.layer_panel_open = true;
            this.unhideLayerButtons();
            ui.buttonSwitch(this.btn_layer_panel);
        }
    }

    closePropPanel() {
        if (this.prop_panel_open) {
            this.prop_panel_open = false;
            this.resizeHeight(window.innerHeight - 172 - 58);
            ui.buttonSwitch(this.btn_prop_panel);
        }
        if (!this.layer_panel_open) {
            this.memorized_height = 0;
            this.openLayerPanel();
        }
    }

    openPropPanel() {
        if (!this.prop_panel_open) {
            this.prop_panel_open = true;
            ui.buttonSwitch(this.btn_prop_panel);
        }
    }

    newSceneButton() {
        layers.newSceneLayer();
    }

    scrollLayers(pos) {
        this.lp_content_wrapper.scrollTop = pos;
    }

    scrollToLayer(layer) {
        var scroll = this.lp_content_wrapper.scrollTop;
        var y = layer.getLayerElement().getBoundingClientRect().top - 144 + scroll;
        var h = this.height-58-49;

        if (y < scroll) {
            this.lp_content_wrapper.scroll({top: y, behavior: 'smooth'});
        }
        if (y > scroll + h - 1) {
            this.lp_content_wrapper.scroll({top: y+layer.height-h, behavior: 'smooth'});
        }
        if (layer.getLayerElement().getBoundingClientRect().bottom-31 == this.lp_content_container.getBoundingClientRect().bottom) {
            timers.setTimer(timers.scroll_timer, 20);
        }
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Layer Manager
//  Handles all layers (sorting, nesting, etc.)
// ------------------------------------------------------------
class layerManager {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.scenes = [];
        this.layers = [];
        this.objects = [];
        this.selected = [];
        this.active_scene = null;
        this.last_selected = -1;
    }

    newSceneLayer() {
        var scene = new layerScene();
        this.scenes.push(scene);
        this.select(scene);
        panels.scrollToLayer(scene);
        return scene;
    }

    newWindowLayer() {
        var renderObj = new MZWindow();
        //renderObj.move(x, y);
        this.objects.push(renderObj);
        var win = new layerWindow();
        this.layers.push(win);
        win.setRenderObject(renderObj);
        this.select(win);
        panels.scrollToLayer(win);
        return win;
    }

    deselectAllScenes() {
        for (var i = 0; i < this.scenes.length; i++) {
            this.scenes[i].deselect();
        }
    }

    deselectAllLayers() {
        for (var i = 0; i < this.selected.length; i++) {
            this.selected[i].deselect();
        }
        this.selected = [];
    }

    select(layer) {
        if (layer.type == ltype.scn) {
            if (layer != this.active_scene) {
                this.deselectAllLayers();
                this.deselectAllScenes();
                this.active_scene = layer;
                layer.select();
            }
        } else {
            if (layer.scene_layer != this.active_scene) { 
                this.deselectAllScenes();
                this.select(layer.scene_layer);
            }
            this.deselectAllLayers();
            this.selected.push(layer);
            this.last_selected = this.getLayerIndex(layer);
            layer.select();
            grid.refresh();
        }
    }

    toggleSelect(layer) {
        var index;
        for (var i = 0; i < this.selected.length; i++) {
            if (this.selected[i] == layer) {
                index = i;
                break;
            }
        }
        if (layer.selected()) {
            layer.deselect();
            this.selected.splice(index, 1);
        } else {
            if (layer.scene_layer != this.active_scene) {
                //this.deselectAllLayers();
                //console.log(layer.scene_layer);
                //console.log(this.active_scene);
                this.select(layer.scene_layer);
            }
            layer.select();
            this.selected.push(layer);
            //console.log(this.selected);
        }
        grid.refreshSelection();
    }

    getScene() {
        return this.active_scene;
    }

    getSceneContentsElem() {
        return ui.getElement(this.active_scene.layer_contents);
    }

    getSceneIndex(scene) {
        for (var i = 0; i < this.scenes.length; i++) {
            if (this.scenes[i] == scene) {
                return i;
            }
        }
        return -1;
    }

    getLayerIndex(layer) {
        for (var i = 0; i < this.layers.length; i++) {
            if (this.layers[i] == layer) {
                return i;
            }
        }
        return -1;
    }

    getObjectIndex(obj) {
        for (var i = 0; i < this.objects.length; i++) {
            if (this.objects[i] == obj) {
                return i;
            }
        }
        return -1;
    }

    removeScene(scene) {
        var index = this.getSceneIndex(scene);
        this.scenes[index].deleteLayer();
        this.scenes.splice(index, 1);
    }

    removeLayer(layer) {
        var index = this.getLayerIndex(layer);
        //console.log(this.layers[index])
        this.layers[index].deleteLayer();
        this.layers.splice(index, 1);
    }

    removeObject(obj) {
        var index = this.getObjectIndex(obj);
        this.objects.splice(index, 1);
    }

    deleteSelected() {
        for (var i = 0; i < this.selected.length; i++) {
            this.removeLayer(this.selected[i]);
        }
        this.deselectAllLayers();
        grid.refreshSelection();
    }
    /*
    getAllLayers() {
        var check = [];
        this.layers = [];
        this.scenes.forEach(e => check.push(e));
    
        while (check.length > 0) {
            this.layers.push(check[0]);
            if (check[0].child_layers.length > 0) {
                check[0].child_layers.forEach(e => check.push(e));
            }
            check.splice(0, 1);
        }
        //console.log(this.layers);
    }
        */

    mouseInObject(mouse_x, mouse_y) {
        //if (!mouseInStageArea()) { return; }
        //this.getAllLayers();
        for (var i = 0; i < this.layers.length; i++) {
            var obj = this.layers[i].render_object;
            if (!obj) { continue; }
            if (!obj.visible) { continue; }
            var xx = obj.x + stage.x;
            var x2 = obj.x + obj.width + stage.x;
            var yy = obj.y + stage.y;
            var y2 = obj.y + obj.height + stage.y;
            if (mouse_x > xx && mouse_x < x2 && mouse_y > yy && mouse_y < y2) {
                return obj;
            }
        }
    }

    moveSelectedLayers(move_x, move_y) {
        for (var i = 0; i < this.selected.length; i++) {
            var win = this.selected[i].render_object;
            if (!win.visible) { continue; }
            win.move(win.x + move_x, win.y + move_y);
            grid.refreshSelection();
        }
    }

    windowsInBox(x1, y1, x2, y2) {
        var windows = [];
        for (var i = 0; i < this.objects.length; i++) {
            if (!this.objects[i].visible) { continue; }
            var wx1 = this.objects[i].x;
            var wx2 = this.objects[i].x + this.objects[i].width;
            var wy1 = this.objects[i].y;
            var wy2 = this.objects[i].y + this.objects[i].height;
            //console.log(mouse_x, mouse_y);
            if (x1 > wx1 && x1 < wx2 && y2 > wy1 && y1 < wy1) { windows.push(this.objects[i]); continue; }
            if (x1 > wx1 && x1 < wx2 && y2 < wy2 && y1 > wy2) { windows.push(this.objects[i]); continue; }
            if (y1 > wy1 && y1 < wy2 && x2 > wx1 && x1 < wx1) { windows.push(this.objects[i]); continue; }
            if (y1 > wy1 && y1 < wy2 && x2 < wx2 && x1 > wx2) { windows.push(this.objects[i]); continue; }

            if (x2 < wx2 && y2 < wy2 && x1 > wx2 && y1 > wy2) { windows.push(this.objects[i]); continue; }
            if (x2 < wx2 && y2 > wy1 && x1 > wx2 && y1 < wy2) { windows.push(this.objects[i]); continue; }
            if (x2 > wx1 && y2 < wy2 && x1 < wx1 && y1 > wy2) { windows.push(this.objects[i]); continue; }
            if (x2 > wx1 && y2 > wy1 && x1 < wx1 && y1 < wy2) { windows.push(this.objects[i]); continue; }
        }
        return windows;
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Layer Base
//  The base class of all layers
// ------------------------------------------------------------
const lstate = {
    non: 0,
    hov: 1,
    sel: 2
}
const ltype = {
    scn: 0,
    win: 1,
    grp: 2,
    img: 3
};
class layerBase {
    constructor() {
        //this.initialize(...arguments);
    }

    initialize() {
        this.id = layer_id;
        this.name = "";
        this.height = 0;
        this.content_height = 0;
        this.off_y = 0;
        this.depth = 0;
        this.type = ltype.scn;

        this.container = panels.lp_content_container;
        this.layer_elem = null;
        this.layer_contents = null;
        this.layer_icon = null;
        this.layer_depth = [];
        this.render_object = null;

        this.icon  = "layer-group-icon.svg";
        this.nav   = "layer-nav-line.svg";

        this.txt_col   = "#4a5568";
        this.txt_col_h = "#6c7a8c";
        this.txt_col_s = "#a0aec0";
        this.bg_col    = "#1a1d2e";
        this.bg_col_s  = "#333a4c";

        this.parent_layer = null;
        this.child_layers = [];

        this.state = lstate.non;
        this.open = false;

        layer_id += 1;
    }

    createUI(parent) {
        var depth_offset = this.depth * 22;

        this.layer_elem = ui.createElement("layer_" + this.id, parent, "div");
        ui.setPos(this.layer_elem, "left", "0px", "top", "0px");
        ui.setSize(this.layer_elem, "100%", this.height + this.content_height + "px");
        ui.setLayerStyle(this.layer_elem);

        this.layer_contents = ui.createElement("layer_" + this.id + "contents", ui.getElement(this.layer_elem), "div");
        ui.setPos(this.layer_contents, "left", "0px", "top", this.height + "px");
        ui.setSize(this.layer_contents, "100%", "0px");

        this.layer_icon = ui.createElement("layer_" + this.id + "icon", ui.getElement(this.layer_elem), "img");
        ui.setPos(this.layer_icon, "left", 47 + depth_offset + "px", "top", this.off_y + 11 + "px");
        ui.setSize(this.layer_icon, "23px", "23px");
        ui.setImage(this.layer_icon, "layer-group-icon.svg");

        this.layer_dropdown = ui.createElement("layer_" + this.id + "dropdown", ui.getElement(this.layer_elem), "img");
        ui.setPos(this.layer_dropdown, "left", 17 + depth_offset + "px", "top", this.off_y + 11 + "px");
        ui.setSize(this.layer_dropdown, "23px", "23px");
        ui.setImage(this.layer_dropdown, "layer-closed.svg");
        ui.makeButton(this.layer_dropdown, null);
        ui.setButtonAlt(this.layer_dropdown, "layer-open.svg");

        this.layer_name = ui.createElement("layer_" + this.id + "name", ui.getElement(this.layer_elem), "div");
        ui.setPos(this.layer_name, "left", 82 + depth_offset + "px", "top", this.off_y + 13 + "px");
        ui.addText(this.layer_name, this.name, "RMed", "12pt", this.txt_col);

        for (var i = 0; i < this.depth; i++) {
            this.layer_depth[i] = ui.createElement("layer" + this.id + "depth" + i, ui.getElement(this.layer_elem), "img");
            ui.setPos(this.layer_depth[i], "left", 18+(21*i) + "px", "top", "0px");
            ui.setSize(this.layer_depth[i], "20px", "31px");
            ui.setImage(this.layer_depth[i], this.nav);
        }

        var thislayer = this;
        ui.getElement(this.layer_dropdown).onmousedown = function(e) {
            thislayer.toggleLayer();
        }
        ui.getElement(this.layer_elem).onmouseover = function(e) {
            thislayer.mouseOverEvent(e);
        }
        ui.getElement(this.layer_elem).onmouseout = function(e) {
            if (checkMouseOut(e, ui.getElement(thislayer.layer_elem))) {
                thislayer.mouseOutEvent(e);
            }
        }
        ui.getElement(this.layer_elem).onmousedown = function(e) {
            thislayer.mouseDownEvent(e);
        }
        ui.getElement(this.layer_elem).onmouseup = function(e) {
            thislayer.mouseUpEvent(e);
        }
    }

    mouseOverEvent(e) {
        if (this.state == lstate.non) {
            this.state = lstate.hov;
        }
        this.updateUI();
    }

    mouseOutEvent(e) {
        if (this.state == lstate.hov) {
            this.state = lstate.non;
        }
        this.updateUI();
    }

    mouseDownEvent(e) {
        var element_pos = ui.getElement(this.layer_elem).getBoundingClientRect();
        if (e.clientY > element_pos.top + this.height) { return; }
        if (action.checkMod(MOD.CTRL)) {
            layers.toggleSelect(this);
            console.log("Why are you doing this? Eh?");
            return;
        }
        if (action.checkMod(MOD.SHFT)) {
            var last_selected = -1;
            if (layers.selected.length > 0) {
                last_selected = layers.selected[layers.selected.length-1];
            } else {
                layers.select(this);
                return;
            }
            var start, end;
            var index = layers.getLayerIndex(this);
            var last_selected_index = layers.getLayerIndex(last_selected);
            if (index < last_selected_index) { start = index; end = last_selected_index; }
            else if (index > last_selected_index) { start = last_selected_index; end = index; }
            layers.deselectAllLayers();
            for (var i = start; i <= end; i++) {
                layers.toggleSelect(layers.layers[i]);
            }
            //return;
        }
        if (!action.checkMod(MOD.SHFT) && ! action.checkMod(MOD.CTRL)) {
            layers.select(this);
        }
    }

    mouseUpEvent(e) {

    }

    getLayerElement() {
        return ui.getElement(this.layer_elem);
    }

    updateUI() {
        switch (this.state) {
            case lstate.non:
                ui.getElement(this.layer_name).style.color = this.txt_col;
                ui.setImage(this.layer_icon, this.icon);
                ui.changeButtonImage(this.layer_dropdown, "layer-closed.svg");
                ui.changeButtonAlt(this.layer_dropdown, "layer-open.svg");
                break;
            case lstate.hov:
                ui.getElement(this.layer_name).style.color = this.txt_col_h;
                ui.setImageHover(this.layer_icon, this.icon);
                ui.changeButtonImage(this.layer_dropdown, "layer-closed-hover.svg");
                ui.changeButtonAlt(this.layer_dropdown, "layer-open-hover.svg");
                break;
            case lstate.sel:
                ui.getElement(this.layer_name).style.color = this.txt_col_s;
                ui.setImageSelected(this.layer_icon, this.icon);
                ui.changeButtonImage(this.layer_dropdown, "layer-closed-selected.svg");
                ui.changeButtonAlt(this.layer_dropdown, "layer-open-selected.svg");
                break;
        }

        if (this.open) {
            ui.getElement(this.layer_elem).style.height = this.height + this.content_height + "px";
        } else {
            ui.getElement(this.layer_elem).style.height = this.height + "px";
        }
    }

    changeHeight(height) {
        ui.getElement(this.layer_elem).style.height = height + "px";
    }

    changeIcon(icon) {
        ui.setImage(this.layer_icon, icon);
    }

    changeName(name) {
        ui.getElement(this.layer_name).innerText = name;
    }

    select() {
        this.state = lstate.sel;
        this.updateUI();
    }

    deselect() {
        this.state = lstate.non;
        this.updateUI();
    }

    selected() {
        return this.state == lstate.sel;
    }

    nest(layer) {
        this.child_layers.push(layer);
        layer.parent_layer = this;
        this.content_height += layer.height;
        if (layer.open) { this.content_height += layer.content_height; }
        if (this.open) { 
            this.updateUI();
        }
        else {
            this.openLayer();
        }
    }

    toggleLayer() {
        if (this.open) {
            this.closeLayer();
        } else if (this.child_layers.length > 0) {
            this.openLayer();
        }
    }

    openLayer() {
        if (!this.open) {
            ui.buttonSwitch(this.layer_dropdown);
            this.open = true;
            this.updateUI();
        }
    }
     
    closeLayer() {
        if (this.open) {
            ui.buttonSwitch(this.layer_dropdown);
            this.open = false;
            this.updateUI();
        }
    }

    setRenderObject(render_object) {
        this.render_object = render_object;
        render_object.parent_layer = this;
    }

    deleteLayer() {
        for (var i = 0; i < this.child_layers.length; i++) {
            this.child_layers[i].deleteLayer();
        }
        ui.getElement(this.layer_elem).remove();
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Layer Scene
//  Contains window and image layers that make up a scene
// ------------------------------------------------------------
var scene_layer_num = 0;
class layerScene extends layerBase {
    constructor() {
        super();
        this.initialize(...arguments);
    }

    initialize() {
        super.initialize();
        scene_layer_num += 1;

        this.icon = "layer-scene-icon.svg";
        this.icon_edit = "layer-edit-icon.svg";

        this.txt_col_e = "#a0aec0";
        this.bg_col    = "";
        this.bg_col_s  = "";

        this.type = ltype.scn;
        this.name = "Scene " + scene_layer_num;
        this.height = 44;
        this.content_height = 0;

        this.layer_edit = null;

        this.createUI(this.container);
    }

    createUI(parent) {
        super.createUI(parent);
        this.changeHeight(this.height);
        this.changeIcon(this.icon);
        this.changeName(this.name);

        this.layer_edit = ui.createElement("layer_" + this.id + "edit", ui.getElement(this.layer_elem), "img");
        ui.setPos(this.layer_edit, "right", "24px", "top", "11px");
        ui.setSize(this.layer_edit, "23px", "23px");
        ui.setImage(this.layer_edit, this.icon_edit);
        ui.hide(this.layer_edit);
    }

    select() {
        super.select();
        ui.getElement(this.layer_edit).style.visibility = "visible";
    }

    deselect() {
        super.deselect();
        ui.getElement(this.layer_edit).style.visibility = "hidden";
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Layer Window
//  Represents MZ windows in the layer panel
// ------------------------------------------------------------
var window_layer_num = 0;
class layerWindow extends layerBase {
    constructor() {
        super();
        this.initialize(...arguments);
    }

    initialize() {
        super.initialize();
        window_layer_num += 1;

        this.txt_col   = "#333a4c";
        this.txt_col_h = "#4a5568";
        this.txt_col_s = "#e2e8f0";

        this.icon = "layer-window-icon.svg";
    
        this.type = ltype.win;
        this.name = "Window " + window_layer_num;
        this.height = 31;
        this.off_y = -7;
        this.depth = 1;
    
        this.visible = true;
        this.locked = false;

        this.scene_layer = layers.getScene();
        this.createUI(layers.getSceneContentsElem());
        layers.getScene().nest(this);
    }

    createUI(parent) {
        super.createUI(parent);
        this.changeHeight(this.height);
        this.changeIcon(this.icon);
        this.changeName(this.name);

        ui.setBgColor(this.layer_elem, "#1a1d2e");

        this.layer_visible = ui.createElement("layer_" + this.id + "eye", ui.getElement(this.layer_elem), "img");
        ui.setPos(this.layer_visible, "right", "23px", "top", "5px");
        ui.setSize(this.layer_visible, "23px", "23px");
        ui.setImage(this.layer_visible, "layer-visible.svg");
        ui.makeButton(this.layer_visible, null);
        ui.setButtonAlt(this.layer_visible, "layer-invisible.svg");

        this.layer_lock = ui.createElement("layer_" + this.id + "lock", ui.getElement(this.layer_elem), "img");
        ui.setPos(this.layer_lock, "right", "45px", "top", "6px");
        ui.setSize(this.layer_lock, "23px", "23px");
        ui.setImage(this.layer_lock, "layer-unlocked.svg");
        ui.makeButton(this.layer_lock, null);
        ui.setButtonAlt(this.layer_lock, "layer-locked.svg");

        var thislayer = this;
        ui.getElement(this.layer_visible).onmousedown = function(e) {
            thislayer.toggleHide();
        }
        ui.getElement(this.layer_lock).onmousedown = function(e) {
            thislayer.toggleLock();
        }
    }

    updateUI() {
        super.updateUI();
        switch (this.state) {
            case lstate.non:
                ui.changeButtonImage(this.layer_visible, "layer-visible.svg");
                ui.changeButtonAlt(this.layer_visible, "layer-invisible.svg");
                ui.changeButtonImage(this.layer_lock, "layer-unlocked.svg");
                ui.changeButtonAlt(this.layer_lock, "layer-locked.svg");
                break;
            case lstate.hov:
                ui.changeButtonImage(this.layer_visible, "layer-visible-hover.svg");
                ui.changeButtonAlt(this.layer_visible, "layer-invisible-hover.svg");
                ui.changeButtonImage(this.layer_lock, "layer-unlocked-hover.svg");
                ui.changeButtonAlt(this.layer_lock, "layer-locked-hover.svg");
                break;
            case lstate.sel:
                ui.changeButtonImage(this.layer_visible, "layer-visible-selected.svg");
                ui.changeButtonAlt(this.layer_visible, "layer-invisible-selected.svg");
                ui.changeButtonImage(this.layer_lock, "layer-unlocked-selected.svg");
                ui.changeButtonAlt(this.layer_lock, "layer-locked-selected.svg");
                break;
        }
    }

    toggleHide() {
        ui.buttonSwitch(this.layer_visible);
    }

    toggleLock() {
        ui.buttonSwitch(this.layer_lock);
    }

    select() {
        super.select();
        ui.setBgColor(this.layer_elem, "#333a4c");
        for (var i = 0; i < this.depth; i++) {
            ui.setImageSelected(this.layer_depth[i], this.nav);
        }
    }

    deselect() {
        super.deselect();
        ui.setBgColor(this.layer_elem, "#1a1d2e");
        for (var i = 0; i < this.depth; i++) {
            ui.setImage(this.layer_depth[i], this.nav);
        }
    }

    deleteLayer() {
        this.render_object.delete();
        super.deleteLayer();
    }
}

// ------------------------------------------------------------
// MZ Window system
// ------------------------------------------------------------
class MZWindow {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.x = 0;
        this.y = 0;
        this.off_x = 0;
        this.off_y = 0;
        //this.previous_x = 0;
        //this.previous_y = 0;
        //this.previous_w = 0;
        //this.previous_h = 0;
        this.store = { x: 0, y: 0, w: 0, h: 0 }
        this.width = 0;
        this.height = 0;
        this.skin = null;

        this.padding = 12;
        this.margin = 4;
        this.parent_layer = null;
        this.visible = true;

        this.container = new PIXI.Container();
        this.frameSprite = new PIXI.Graphics();
        this.backSprite = new PIXI.Graphics();
        this.container.addChild(this.frameSprite);
        this.container.addChild(this.backSprite);

        stage.addChild(this.container);
    }

    move(x, y) {
        this.container.x = x;
        this.container.y = y;
        this.x = x;
        this.y = y;
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.drawBack();
    }

    delete() {
        this.container.parent.removeChild(this.container);
        const options = { children: true, texture: true };
        this.container.destroy(this.container, options);

        layers.removeObject(this);
        /*
        for (var i = 0; i < layers.objects.length; i++) {
            if (layers.objects[i] == this) {
                layers.objects.splice(i, 1);
            }
        }
        */
    }

    drawBack() {
        this.backSprite.clear();

        // Test box (kill this guy later)
        //this.backSprite.lineStyle(2, 0x3b3e51);
        this.backSprite.alpha = 0.3;
        this.backSprite.beginFill(0x3b3e51);
        this.backSprite.drawRect(0, 0, this.width, this.height);
        this.backSprite.endFill();
    }

    addChild(child) {
        this.container.addChild(child);
    }

    hide() {
        this.container.visible = false;
        this.visible = false;
    }

    unhide() {
        this.container.visible = true;
        this.visible = true;
    }

    setMouseOffset() {
        this.off_x = input.mouse_pos.sx - this.x;
        this.off_y = input.mouse_pos.sy - this.y;
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// UI Button Functions
//   Functions used by ui buttons
// ------------------------------------------------------------
function closeWindow() {
    ipc.send('closeApp');
}

function maximizeWindow() {
    ipc.send('maximizeApp');
}

function minimizeWindow() {
    ipc.send('minimizeApp');
}

function openSettings() {
    // Call the settings window and stuff
}

function openMenu() {
    // Call the menu and stuff
}

function select_move_tool() {
    action.setTool("move_tool");
}

function select_draw_tool() {
    action.setTool("draw_tool");
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Create Main UI
// ------------------------------------------------------------
function createUI() {
    //document.body.style.zoom = "90%";

    var workspace = ui.createElement("workspace", document.body, "div");
    ui.setPos(workspace, "left", "0px", "top", "0px");
    ui.setSize(workspace, "100%", "100%");
    //ui.setBgColor(workspace, "#0f0e1c");
    //ui.getElement(workspace).style.borderRadius = "5px";

    var titlebar = ui.createElement("titlebar", document.body, "div");
    ui.setPos(titlebar, "left", "0px", "top", "0px");
    ui.setSize(titlebar, "100%", "56px");
    ui.setWindowDragRegion(titlebar);

    var btn_close = ui.createElement("btn_close", ui.getElement(titlebar), "img");
    ui.setPos(btn_close, "right", "10px", "top", "10px");
    ui.setSize(btn_close, "37px", "37px");
    ui.setImage(btn_close, "titlebar-close.svg");
    ui.makeButton(btn_close, closeWindow);

    var btn_max = ui.createElement("btn_max", ui.getElement(titlebar), "img");
    ui.setPos(btn_max, "right", "50px", "top", "10px");
    ui.setSize(btn_max, "37px", "37px");
    ui.setImage(btn_max, "titlebar-max.svg");
    ui.makeButton(btn_max, maximizeWindow);

    var btn_min = ui.createElement("btn_min", ui.getElement(titlebar), "img");
    ui.setPos(btn_min, "right", "90px", "top", "10px");
    ui.setSize(btn_min, "37px", "37px");
    ui.setImage(btn_min, "titlebar-min.svg");
    ui.makeButton(btn_min, minimizeWindow);

    var btn_settings = ui.createElement("btn_settings", ui.getElement(titlebar), "img");
    ui.setPos(btn_settings, "right", "160px", "top", "10px");
    ui.setSize(btn_settings, "37px", "37px");
    ui.setImage(btn_settings, "titlebar-settings.svg");
    ui.makeButton(btn_settings, openSettings);

    var btn_menu = ui.createElement("btn_menu", ui.getElement(titlebar), "img");
    ui.setPos(btn_menu, "left", "90px", "top", "10px");
    ui.setSize(btn_menu, "37px", "37px");
    ui.setImage(btn_menu, "titlebar-menu.svg");
    ui.makeButton(btn_menu, openMenu);

    var title_text = ui.createElement("title_text", ui.getElement(titlebar), "div");
    ui.setPos(title_text, "left", "138px", "top", "17px");
    ui.addText(title_text, "New Project / Scene 1", "RBold", "15pt", "#e2e8f0");

    var toolbar = ui.createElement("toolbar", document.body, "div");
    ui.setPos(toolbar, "left", "0px", "top", "0px");
    ui.setSize(toolbar, "77px", "100%");
    ui.setBgColor(toolbar, "#1a1d2e");

    var logo = ui.createElement("logo", ui.getElement(toolbar), "img");
    ui.setPos(logo, "left", "0px", "top", "0px");
    ui.setSize(logo, "77px", "77px");
    ui.setImage(logo, "sidebar-logo-bg.svg");

    var btn_tool_move = ui.createElement("btn_tool_move", ui.getElement(toolbar), "img");
    ui.setPos(btn_tool_move, "left", "14px", "top", "131px");
    ui.setSize(btn_tool_move, "50px", "50px");
    ui.setImage(btn_tool_move, "sidebar-tool-move.svg");
    ui.makeButton(btn_tool_move, select_move_tool);
    ui.setButtonGroup(btn_tool_move, 1);

    var btn_tool_draw = ui.createElement("btn_tool_draw", ui.getElement(toolbar), "img");
    ui.setPos(btn_tool_draw, "left", "14px", "top", "203px");
    ui.setSize(btn_tool_draw, "50px", "50px");
    ui.setImage(btn_tool_draw, "sidebar-tool-draw.svg");
    ui.makeButton(btn_tool_draw, select_draw_tool);
    ui.setButtonGroup(btn_tool_draw, 1);

    ui.pressButton(btn_tool_move);
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Create Pixi Renderer
// ------------------------------------------------------------
function createRenderer() {
    stage = new PIXI.Container();
    renderer = new PIXI.Renderer({
        backgroundAlpha: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio,
        antialias: true,
    });
    ui.findElement("workspace").appendChild(renderer.view);
    renderer.view.style.position = 'fixed';
    renderer.view.style.width = '100vw';
    renderer.view.style.height = '100vh';
    renderer.view.style.top = 0;
    renderer.view.style.left = 0;
    //renderer.backgroundColor = 0x0F0E1C;
    // NOTE: Not sure how this works but the commented line above is
    // needed for the bg to work on Linux, but it breaks it on Windows

    // Move container to the center
    stage.x = renderer.width / 2;
    stage.y = renderer.height / 2;

    // Center local container coordinates
    stage.pivot.x = stage.width / 2;
    stage.pivot.y = stage.height / 2;
    stage.sortableChildren = true;

    // Window resize event
    window.addEventListener('resize', resizeWindow);

    // Load spritesheet
    loader.add(img_path + "spritesheet.json").load(spriteSheetSetup);
}

function resizeWindow() {
    renderer.resize(window.innerWidth, window.innerHeight);

    ui.setAnim(panels.layer_panel, "height 0s ease-out");
    ui.setAnim(panels.prop_panel, "height 0s ease-out");
    //panels.openLayerPanel();
    //panels.openPropPanel();
    //var nh = clamp(window.innerHeight/2 - 50, window.innerHeight-327, 155);
    if (!panels.prop_panel_open) {
        var nh = window.innerHeight - 172 - 58;
    } else if (!panels.layer_panel_open) {
        var nh = 58;
    } else {
        var nh = clamp(window.innerHeight/2 - 50, window.innerHeight-327, 155);
    }
    panels.resizeHeight(nh);
}

var sprite_sheet = null;
var sprite_sheet_loaded = false;

function spriteSheetSetup() {
    sprite_sheet = loader.resources[img_path + "spritesheet.json"].spritesheet;
    sprite_sheet_loaded = true;
    grid.createControlSprites();
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// PROGRAM START
// ------------------------------------------------------------
window.onload = function() {

    ui = new UISystem();
    settings = new settingsSystem();
    input = new inputManager();
    action = new actionSystem();
    project = new projectSystem();

    // Create the program UI
    createUI();

    // Pixi workspace
    createRenderer();
    grid = new gridSystem();

    panels = new panelSystem();
    timers = new timerSystem();
    layers = new layerManager();
    layers.newSceneLayer();

    // Main update loop
    update();
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------
function update() {
    input.update();
    timers.update();
    renderer.render(stage);
    requestAnimationFrame(() => update()); // Do it again
}
// ------------------------------------------------------------