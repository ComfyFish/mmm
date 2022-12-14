//=============================================================================
// Mushi Menu Maker
//
// The ultimate menu maker for RMMZ (and maybe MV someday)
// Sorry everything is in one big file, good luck! :P
//
// (Detailed info is here)
//=============================================================================

const { ipcRenderer } = require('electron');
const { exists } = require('original-fs');
const ipc = ipcRenderer;
const loader = PIXI.Loader.shared;

const img_path = "assets/img/";

var input = null;
var action = null;
var renderer = null;
var stage = null;
var project = null;
var panels = null;
var render_grid = null;
var timers = null;
var ui = null;

function clamp(val, max, min) {
    return Math.min(Math.max(val, min), max);
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
        // The `downHandler`
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
      
        // The `upHandler`
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
        var dist = {x:0, y:0};
        dist.x = this.mouse_pos.x - this.click_pos.x;
        dist.y = this.mouse_pos.y - this.click_pos.y;
        return dist;
    }

    storePos(x, y) {
        this.store_pos.x = x;
        this.store_pos.y = y;
    }

    getStoredPos() {
        return this.store_pos;
    }

    checkMouseOut(e, element) {
        if (e.relatedTarget == null) { return true; }
        if (e.relatedTarget == element) { return false; }
        if (e.relatedTarget.parentElement == element) { return false; }
        if (e.relatedTarget.parentElement.parentElement == element) { return false; }
        return true;
    }

    registerDefaultKeys() {
        this.addKey("keyboard", "a");
        this.registerPressFunction("a", keyPressTest);
        //this.registerHoldFunction("a", keyPressTest);

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
function keyPressTest(key) {
    console.log("Key " + key + " pressed!");
    console.log("Mouse X: " + input.mouse_pos.x + " Mouse Y: " + input.mouse_pos.y);
}

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
}

function mbLeftHold() {
    var dist = input.distanceToClick();
    //var nh = clamp(panel_size.y - dist.y, window.innerHeight-327, 155);
    if (action.checkAction("resize_panels_v")) {
        var panel_size = input.getStoredPos();
        var nw = clamp(panel_size.x - dist.x, window.innerWidth/2, 200);
        panels.width = nw;
        ui.getElement(panels.layer_panel).style.width = nw + "px";
        ui.getElement(panels.prop_panel).style.width = nw + "px";
        ui.getElement(panels.grabby_v).style.right = nw + 30 + "px";
        ui.getElement(panels.grabby_h).style.width = nw + "px";
    }
    if (action.checkAction("resize_panels_h")) {
        var panel_size = input.getStoredPos();
        var nh = clamp(panel_size.y + dist.y, window.innerHeight-327, 155);
        panels.height = nh;
        ui.getElement(panels.layer_panel).style.height = nh + "px";
        ui.getElement(panels.prop_panel).style.height = window.innerHeight - nh - 172 + "px";
        ui.getElement(panels.grabby_h).style.top = nh + 85 + "px";
        ui.getElement(panels.layer_panel_content).style.height = nh - 58 - 49 + "px";
        ui.getElement(panels.prop_panel_content).style.height = window.innerHeight - nh - 172 - 58 + "px";
        ui.getElement(panels.btn_new_group).style.top = nh - 40 + "px";
        ui.getElement(panels.btn_new_scene).style.top = nh - 40 + "px";
        ui.getElement(panels.btn_delete_layer).style.top = nh - 40 + "px";
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
    action.clearAction();
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Action System: 
//   Handles interactive actions, tools, and history states
// ------------------------------------------------------------
class actionSystem {
    constructor() {
        this.initialize(...arguments);
    }

    initialize() {
        this.action = {name:"", store:false, obj:null};
        this.tool = null;
        this.history = [];
    }

    setAction(action) {
        if (this.action.name != "") {
            this.clearAction();
        }
        this.action.name = action;
    }

    checkAction(action) {
        return this.action.name == action;
    }

    actionAddObj(obj) {
        this.action.obj = obj;
    }

    clearAction() {
        if (this.action.name != "" && this.action.store) {
            this.history.push(this.action);
        }
        this.action = {name:"", store:false, obj:null};
    }

    noAction() {
        console.log(this.action.name == "");
        return this.action.name == "";
    }

    setTool(tool) {
        this.tool = tool;
    }

    checkTool(tool) {
        return this.tool == tool;
    }

    clearTool() {
        this.tool = null
    }

    undoAction() {
        if (this.history.length > 0) {
            var act = this.history.pop();
            // Undo the action and stuff
        }
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Grid System: 
//   Pixi-related rendering of the grid and various selection
//   control handles in pixi
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
        this.selection_previous = { x1: 0, y1: 0, x2: 0, y2: 0 };

        this.handle = [];
        this.handle_hover = -1;
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
        if (panels.selected_layers.length == 0) { return; }
        if (mouse_state.type == "window_draw") { return; }

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
        for (var i = 0; i < panels.selected_layers.length; i++) {
            var obj = panels.selected_layers[i].render_object;
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

    handleHover(mx, my) {
        for (var i = 0; i < this.handle.length; i++) {
            if (Math.abs(mx - stage.x - this.handle[i].position.x) < 15 && Math.abs(my - stage.y - this.handle[i].position.y) < 15) {
                this.handle_hover = i;
                return i;
            }
        }
        this.handle_hover = -1;
        return -1;
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
        if (panels.selected_layers.length > 0) {
            panels.deselectAllLayers();
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
            scrollLayers(100000);
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

    updateTimers() {
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

const btn = {
    ele: 0,
    img: 1,
    prs: 2,
    tgl: 3,
    grp: 4,
    fnc: 5
};

// ------------------------------------------------------------
// UI System:
//   Helper class for making UIs and stuff
// ------------------------------------------------------------
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

    addText(element, text, font, font_size, color) {
        this.element[element].innerText = text;
        this.element[element].style.fontFamily = font;
        this.element[element].style.fontSize = font_size;
        this.element[element].style.color = color;
    }

    makeButton(element, click_function) {
        var button = [];
        button[btn.ele] = element;
        button[btn.img] = this.element[element].src;
        button[btn.iel] = this.element[element];
        button[btn.prs] = false;
        button[btn.tgl] = false;
        button[btn.grp] = 0;
        button[btn.fnc] = click_function;

        this.element[element].onmouseover = function (e) {
            console.log("Thang");
            if (button[btn.prs] == false) {
                button[btn.iel].src = button[btn.img].split(".")[0] + "-hover.svg";
            }
        };

        this.element[element].onmouseout = function (e) {
                if (button[btn.prs] == false) {
                    button[btn.iel].src = button[btn.img];
                }
        };

        this.element[element].onclick = function (e) {
            ui.pressButton(element);
            //if (click_function) {click_function();}
        };

        this.button.push(button);
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
        if (button != -1) {
            var group = this.button[button][btn.grp];
            if (group || this.button[button][btn.tgl]) {
                this.unpressGroup(group);
                this.button[button][btn.prs] = true;
                this.button[button][btn.iel].src = this.button[button][btn.img].split(".")[0] + "-selected.svg";
            }
            var button_function = this.button[button][btn.fnc];
            if (button_function) { button_function(); }
        }
    }

    unpressButton(element) {
        var button = this.findButton(element);
        if (button != -1) {
            this.button[button][btn.prs] = false;
            this.button[button][btn.iel].src = this.button[button][btn.img];
        }
    }

    setButtonGroup(element, group) {
        var button = this.findButton(element);
        if (button != -1) {
            this.button[button][btn.grp] = group;
        }
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

    buttonSetImage(element, img_element) {
        var button = this.findButton(element);
        if (button != -1) {
            this.button[button][btn.iel] = this.element[img_element];
            this.button[button][btn.img] = this.element[img_element].src;
        }
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
        this.btn_new_group = null;
        this.btn_new_scene = null;
        this.bth_delete_layer = null;

        this.lp_content_container = null;
        this.pp_content_container = null;

        this.layer_panel_open = true;
        this.prop_panel_open = true;

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

        var btn_layer_panel = ui.createElement("btn_layer_panel", ui.getElement(this.layer_panel), "div");
        ui.setPos(btn_layer_panel, "right", "0px", "top", "0px");
        ui.setSize(btn_layer_panel, this.width + "px", "58px");
        ui.makeButton(btn_layer_panel, toggleLayerPanel);

        var layer_dropdown = ui.createElement("layer_dropdown", ui.getElement(btn_layer_panel), "img");
        ui.setPos(layer_dropdown, "right", "20px", "top", "20px");
        ui.setSize(layer_dropdown, "20px", "20px");
        ui.setImage(layer_dropdown, "layers-title-open.svg");
        ui.buttonSetImage(btn_layer_panel, layer_dropdown);

        // Layer panel content
        this.layer_panel_content = ui.createElement("lp_content", ui.getElement(this.layer_panel), "div");
        ui.setPos(this.layer_panel_content, "left", "0px", "top", "58px");
        ui.setSize(this.layer_panel_content, "100%", this.height - 58 - 49 + "px");
        new SimpleBar(ui.getElement(this.layer_panel_content));
        this.lp_content_container = document.getElementsByClassName("simplebar-content")[0];

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
        ui.makeButton(this.btn_new_scene, null);

        this.btn_delete_layer = ui.createElement("btn_new_scene", ui.getElement(this.layer_panel), "img");
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

        var btn_prop_panel = ui.createElement("btn_prop_panel", ui.getElement(this.prop_panel), "div");
        ui.setPos(btn_prop_panel, "right", "0px", "top", "0px");
        ui.setSize(btn_prop_panel, this.width + "px", "58px");
        ui.makeButton(btn_prop_panel, togglePropPanel);

        var prop_dropdown = ui.createElement("prop_dropdown", ui.getElement(btn_prop_panel), "img");
        ui.setPos(prop_dropdown, "right", "20px", "top", "20px");
        ui.setSize(prop_dropdown, "20px", "20px");
        ui.setImage(prop_dropdown, "layers-title-open.svg");
        ui.buttonSetImage(btn_prop_panel, prop_dropdown);

        // Properties panel content
        this.prop_panel_content = ui.createElement("lp_content", ui.getElement(this.prop_panel), "div");
        ui.setPos(this.prop_panel_content, "left", "0px", "top", "58px");
        ui.setSize(this.prop_panel_content, "100%", wh - this.height - 172 - 58 + "px");
        new SimpleBar(ui.getElement(this.prop_panel_content));
        this.pp_content_container = document.getElementsByClassName("simplebar-content")[1];

        // Grabbies
        this.grabby_v = ui.createElement("grabby_v", document.body, "div");
        ui.setPos(this.grabby_v, "right", 30 + this.width + "px", "top", "95px");
        ui.setSize(this.grabby_v, "14px", "79.5%");
        var grabby_v_line = ui.createElement("grabby_v_line", ui.getElement(this.grabby_v), "div");
        ui.setPos(grabby_v_line, "left", "50%", "top", "0px");
        ui.setSize(grabby_v_line, "1px", "100%");
        ui.setBgColor(grabby_v_line, "#3b3e51");
        ui.setAnim(grabby_v_line, "opacity 0.2s ease-out");
        ui.getElement(grabby_v_line).style.opacity = 0;

        ui.getElement(this.grabby_v).onmouseover = function(e) {
            ui.getElement(grabby_v_line).style.opacity = 1;
        }
        ui.getElement(this.grabby_v).onmouseout = function(e) {
            ui.getElement(grabby_v_line).style.opacity = 0;
        }
        ui.getElement(this.grabby_v).onmousedown = function(e) {
            input.storePos(panels.width, panels.height);
            action.setAction("resize_panels_v");
        }

        this.grabby_h = ui.createElement("grabby_h", document.body, "div");
        ui.setPos(this.grabby_h, "right", "26px", "top", this.height + 85 + "px");
        ui.setSize(this.grabby_h, this.width + "px", "18px");
        var grabby_h_line = ui.createElement("grabby_h_line", ui.getElement(this.grabby_h), "div");
        ui.setPos(grabby_h_line, "left", "0px", "top", "50%");
        ui.setSize(grabby_h_line, "100%", "1px");
        ui.setBgColor(grabby_h_line, "#3b3e51");
        ui.setAnim(grabby_h_line, "opacity 0.2s ease-out");
        ui.getElement(grabby_h_line).style.opacity = 0;

        ui.getElement(this.grabby_h).onmouseover = function(e) {
            ui.getElement(grabby_h_line).style.opacity = 1;
        }
        ui.getElement(this.grabby_h).onmouseout = function(e) {
            ui.getElement(grabby_h_line).style.opacity = 0;
        }
        ui.getElement(this.grabby_h).onmousedown = function(e) {
            input.storePos(panels.width, panels.height);
            action.setAction("resize_panels_h");
            ui.setAnim(panels.layer_panel, "height 0s ease-out");
            ui.setAnim(panels.prop_panel, "height 0s ease-out");
            ui.setAnim(panels.btn_new_group, "height 0s ease-out");
            ui.setAnim(panels.btn_new_scene, "height 0s ease-out");
            ui.setAnim(panels.btn_delete_layer, "height 0s ease-out");
        }
    }

/*  
    this.grabby_vertical.onmousedown = function(e) {
        thisLayer.temp_width = thisLayer.width;
        thisLayer.temp_height = thisLayer.height;

        mouse_state.type = "resize_panels_v";
    }

    this.grabby_horizontal.onmousedown = function(e) {
        thisLayer.temp_width = thisLayer.width;
        if (!thisLayer.open) {
            thisLayer.height = 58;
            thisLayer.open = true;
            thisLayer.updateOpen();
        }
        if (!thisLayer.properties_open) {
            thisLayer.height = window.innerHeight-172-58;
            thisLayer.properties_open = true;
            thisLayer.updateOpen();
        }
        thisLayer.temp_height = thisLayer.height
        thisLayer.window_layers.style.transition = "height 0s ease-out";
        thisLayer.window_properties.style.transition = "height 0s ease-out";
        thisLayer.btn_new_group.style.transition    = "top 0.0s ease-out";
        thisLayer.btn_new_scene.style.transition    = "top 0.0s ease-out";
        thisLayer.btn_delete_layer.style.transition = "top 0.0s ease-out";

        mouse_state.type = "resize_panels_h";
    } */
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

function toggleLayerPanel() {
    if (panels.layers_panel_open) {
        panels.layers_panel_open = false;
        if (!panels.prop_panel_open) { togglePropPanel(); }
    } else {
        panels.layers_panel_open = true;
    }
}

function togglePropPanel() {
    if (panels.prop_panel_open) {
        panels.prop_panel_open = false;
        if (!panels.layers_panel_open) { toggleLayerPanel(); }
    } else {
        panels.prop_panel_open = true;
    }
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
    renderer.backgroundColor = 0x0F0E1C;
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
}

var sprite_sheet = null;
var sprite_sheet_loaded = false;

function spriteSheetSetup() {
    sprite_sheet = loader.resources[img_path + "spritesheet.json"].spritesheet;
    sprite_sheet_loaded = true;
    render_grid.createControlSprites();
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// PROGRAM START
// ------------------------------------------------------------
window.onload = function() {
    // Main UI
    ui = new UISystem();

    // Input system
    input = new inputManager();
    action = new actionSystem();

    // Project
    project = new projectSystem();

    createUI();

    // Pixi workspace
    createRenderer();
    render_grid = new gridSystem();

    // Layers
    panels = new panelSystem();

    // Main update loop
    update();
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------
function update() {
    input.update();
    renderer.render(stage);
    requestAnimationFrame(() => update()); // Do it again
}
// ------------------------------------------------------------