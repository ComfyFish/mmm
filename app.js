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
var renderer = null;
var stage = null;
var project = null;
var layers = null;
var render_grid = null;
var timers = null;
var ui = null;

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

    registerDefaultKeys() {
        this.addKey("keyboard", "a");
        this.registerPressFunction("a", keyPressTest);
        //this.registerHoldFunction("a", keyPressTest);

        this.addKey("mouse", 1);
        this.registerPressFunction(1, mbMiddlePress);
        this.registerHoldFunction(1, mbMiddleHold);
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
    input.updateClickPos();
    input.storePos(stage.x, stage.y);
}

function mbMiddleHold() {
    var dist = input.distanceToClick();
    stage.x = input.store_pos.x + dist.x;
    stage.y = input.store_pos.y + dist.y;
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Grid System: 
//   Pixi-related rendering of the grid and various selection
// control handles in pixi
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
        if (layers.selected_layers.length == 0) { return; }
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
        for (var i = 0; i < layers.selected_layers.length; i++) {
            var obj = layers.selected_layers[i].render_object;
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
        if (layers.selected_layers.length > 0) {
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

    addText(element, text, font, font_size, color) {
        this.element[element].innerText = text;
        this.element[element].style.fontFamily = font;
        this.element[element].style.fontSize = font_size;
        this.element[element].style.color = color;
    }

    makeButton(element, click_function) {
        var button = [];
        if (this.element[element].src) {
            button[btn.ele] = element;
            button[btn.img] = this.element[element].src;
            button[btn.prs] = false;
            button[btn.tgl] = false;
            button[btn.grp] = 0;
            button[btn.fnc] = click_function;

            this.element[element].onmouseover = function () {
                if (button[btn.prs] == false) {
                    ui.element[element].src = button[btn.img].split(".")[0] + "-hover.svg";
                }
            };

            this.element[element].onmouseout = function () {
                if (button[btn.prs] == false) {
                    ui.element[element].src = button[btn.img];
                }
            };

            this.element[element].onclick = function () {
                ui.pressButton(element);
                //if (click_function) {click_function();}
            };

            this.button.push(button);
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
        if (button != -1) {
            var group = this.button[button][btn.grp];
            if (group || this.button[button][btn.tgl]) {
                this.unpressGroup(group);
                this.button[button][btn.prs] = true;
                this.element[element].src = this.button[button][btn.img].split(".")[0] + "-selected.svg";
            }
            var button_function = this.button[button][btn.fnc];
            if (button_function) { button_function(); }
        }
    }

    unpressButton(element) {
        var button = this.findButton(element);
        if (button != -1) {
            this.button[button][btn.prs] = false;
            this.element[element].src = this.button[button][btn.img];
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
}
// ------------------------------------------------------------

function select_move_tool() {
    console.log("Move tool selected!");
}

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
    ui.makeButton(btn_close, null);

    var btn_max = ui.createElement("btn_max", ui.getElement(titlebar), "img");
    ui.setPos(btn_max, "right", "50px", "top", "10px");
    ui.setSize(btn_max, "37px", "37px");
    ui.setImage(btn_max, "titlebar-max.svg");
    ui.makeButton(btn_max, null);

    var btn_min = ui.createElement("btn_min", ui.getElement(titlebar), "img");
    ui.setPos(btn_min, "right", "90px", "top", "10px");
    ui.setSize(btn_min, "37px", "37px");
    ui.setImage(btn_min, "titlebar-min.svg");
    ui.makeButton(btn_min, null);

    var btn_settings = ui.createElement("btn_settings", ui.getElement(titlebar), "img");
    ui.setPos(btn_settings, "right", "160px", "top", "10px");
    ui.setSize(btn_settings, "37px", "37px");
    ui.setImage(btn_settings, "titlebar-settings.svg");
    ui.makeButton(btn_settings, null);

    var btn_menu = ui.createElement("btn_menu", ui.getElement(titlebar), "img");
    ui.setPos(btn_menu, "left", "90px", "top", "10px");
    ui.setSize(btn_menu, "37px", "37px");
    ui.setImage(btn_menu, "titlebar-menu.svg");
    ui.makeButton(btn_menu, null);

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
    ui.makeButton(btn_tool_draw, null);
    ui.setButtonGroup(btn_tool_draw, 1);
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
    createUI();

    // Input system
    input = new inputManager();

    // Project
    project = new projectSystem();

    // Pixi workspace
    createRenderer();
    render_grid = new gridSystem();

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