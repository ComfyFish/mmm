const { ipcRenderer } = require('electron');
const { exists } = require('original-fs');
const ipc = ipcRenderer;

const img_path = "assets/img/";
const loader = PIXI.Loader.shared;
var sidebar_width = 77;

var input = null;
var renderer = null;
var stage = null;
var project = null;
var mz_window = [];
var layers = null;
var render_grid = null;
var timers = null;

var ui_buttons = [];
var ui_button_group = [];
var tool_selected = "none";
var sprite_sheet = null;
var sprite_sheet_loaded = false;

var snap_grid = false;
var snap_guides = false;
var snap_objects = false;

var mouse_state = {
    type : "",
    x : 0,
    y : 0,
    stage_x : 0,
    stage_y : 0,
    offset_x : 0,
    offset_y : 0,
    layer : null,
    layerheight : 0,
    spacer : null,
    interaction : null,
    on_drag_start : false,
    over_layer : null,
    nest_mode : false,
    tip_timer : 0
};

// Program functions
function normalize(val, max, min) {
    if (max-min == 0) { return 0; }
    return (val-min)/(max-min);
}

function clamp(val, max, min) {
    return Math.min(Math.max(val, min), max);
}

function createImage(id, path) {
    var img = document.createElement("img");
    img.setAttribute("id", id);
    img.setAttribute("draggable", false);
    img.src = path;
    return img;
}

function changeImage(id, path) {
    var img = document.getElementById(id);
    if (img) {
        img.src = path;
    }
}

function uiCreateElement(id, parent) {
    var element = document.createElement("div");
    element.setAttribute("id", id);
    element.setAttribute("class", id);
    parent.appendChild(element);
    return element;
}

function uiCreateButton(id, img, click_func, parent) {
    var btn_array = [id, img, false];
    var btn_num = ui_buttons.push(btn_array);

    var btn = document.createElement("div");
    btn.setAttribute("id", id);
    btn.setAttribute("class", id);
    var btn_img = createImage(id + "_img", img_path + img);
    btn.appendChild(btn_img);

    btn.onmouseover = function() {
        if (ui_buttons[btn_num-1][2] == false) {
            var btn_img = ui_buttons[btn_num-1][1];
            changeImage(id + "_img", img_path + btn_img.split(".")[0] + "-hover.svg");
        }
    }
    btn.onmouseout = function() {
        if (ui_buttons[btn_num-1][2] == false) {
            var btn_img = ui_buttons[btn_num-1][1];
            changeImage(id + "_img", img_path + btn_img);
            console.log("blep");
        }
    }
    btn.onclick = function() {
        //console.log("Button pressed: " + id);
        click_func(id);
    }
    parent.appendChild(btn);
    return btn;
}

function buttonFind(id) {
    for (var i = 0; i < ui_buttons.length; i++) {
        if (ui_buttons[i][0] == id) {
            return i;
        }
    }
}

function buttonFindGroup(id) {
    for (var i = 0; i < ui_button_group.length; i++) {
        for (var j = 0; j < ui_button_group[i].length; j++) {
            if (ui_button_group[i][j] == id) {
                return i;
            }
        }
    }
    return -1;
}

function replaceButtonImg(id, new_img, hover) {
    var btn = buttonFind(id);
    ui_buttons[btn][1] = new_img;
    //var elem = document.getElementById(id);
    //var area = elem.getBoundingClientRect();
    //var mouse_pos = renderer.plugins.interaction.mouse.global;
    if (hover) {
        changeImage(id + "_img", img_path + new_img.split(".")[0] + "-hover.svg");
    } else {
        changeImage(id + "_img", img_path + new_img);
    }
}

function buttonActivate(id) {
    var group = buttonFindGroup(id);
    if (group != -1) {
        ui_button_group[group].forEach(element => {
            var group_btn = buttonFind(element);
            if (ui_buttons[group_btn][0] == id) { 
                ui_buttons[group_btn][2] = true;
                changeImage(id + "_img", img_path + ui_buttons[group_btn][1].split(".")[0] + "-selected.svg");
            }
            else { 
                ui_buttons[group_btn][2] = false;
                changeImage(ui_buttons[group_btn][0] + "_img", img_path + ui_buttons[group_btn][1]);
                //document.getElementById(ui_buttons[group_btn][0]).onmouseout();
            }
        });
    } else {
        var btn = buttonFind(id);
        ui_buttons[btn][2] = true;
        changeImage(id + "_img", img_path + ui_buttons[btn][1].split(".")[0] + "-selected.svg");
    }
}

function buttonDeactivate(btn) {
    ui_buttons[btn][2] = false;
    changeImage(ui_buttons[btn][0] + "_img", img_path + ui_buttons[btn][1]);
}

function buttonActivated(btn) {
    return ui_buttons[btn][2];
}

function buttonToggle(btn) {
    var activated = buttonActivated(btn);
    if (activated) {
        buttonDeactivate(btn);
    } else {
        buttonActivate(ui_buttons[btn][0]);
    }
    return !activated;
}

function uiCreateButtonGroup() {
    var group = [];
    for (var i = 0; i < arguments.length; i++) {
        group[i] = arguments[i];
    }
    var group_num = ui_button_group.push(group);
    buttonActivate(arguments[0]);
    //console.log(ui_button_group);
    return group_num;
}

function uiStyle(id, x_border, x_pos, y_border, y_pos, width, height, bg_color) {
    var str = "position: absolute; " + x_border + ": " + x_pos + "; " + y_border + ": " + y_pos + "; "
    str += "width: " + width + "; height: " + height + "; ";
    if (bg_color != "") {
        str += "background-color: " + bg_color + "; ";
    }
    str += "-webkit-user-select: none; -webkit-app-region: no-drag;";
    document.getElementById(id).setAttribute("style", str);
}

function uiStylePos(id, x_border, x_pos, y_border, y_pos) {
    var str = "position: absolute; " + x_border + ": " + x_pos + "; " + y_border + ": " + y_pos + ";"
    document.getElementById(id).setAttribute("style", str);
}

function uiStyleText(id, x_border, x_pos, y_border, y_pos, font, font_size, color) {
    var str = "position: absolute; " + x_border + ": " + x_pos + "; " + y_border + ": " + y_pos + "; "
    str += "font-family: " + font + "; font-size: " + font_size + "; ";
    if (color != "") {
        str += "color: " + color + "; ";
    }
    str += "-webkit-user-select: none; -webkit-app-region: no-drag;";
    document.getElementById(id).setAttribute("style", str);
    return str;
}

function scrollLayers(pos) {
    document.getElementsByClassName("simplebar-content-wrapper")[0].scrollTop = pos;
}

// ------------------------------------------------------------
// Button functions (called when you press a button)
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

function selectTool(id) {
    buttonActivate(id);
    tool_selected = id;
}

function resizeWindow() {
    renderer.resize(window.innerWidth, window.innerHeight);
    layers.window_layers.style.transition = "height 0s ease-out";
    layers.window_properties.style.transition = "height 0s ease-out";
    layers.window_properties.style.height = window.innerHeight - layers.height - 172 + "px";
}

function createNewGroup() {
    // Make a new group and stuff
    timers.setTimer(timers.scroll_timer, 20);
}

function createNewScene() {
    var scene = new layerScene();
    layers.addSceneLayer(scene);
    //timers.setTimer(timers.scroll_timer, 20);
}

function deleteLayer() {
    for (var i = 0; i < layers.selected_layers.length; i++) {
        layers.selected_layers[i].destroy();
    }
    layers.refreshSpacers();
    layers.deselectAllLayers();
}
// ------------------------------------------------------------

function registerKey(type, value) {
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

function getMouseStagePos() {
    var pos = {};
    pos.x = renderer.plugins.interaction.mouse.global.x - stage.x;
    pos.y = renderer.plugins.interaction.mouse.global.y - stage.y;

    if (snap_grid) {
        var divs_v = Math.round((project.width / project.height) * render_grid.divs);
        var inc = project.width / divs_v;
        var grid_pos = pos.x / inc;
        var dist = grid_pos % 1 - (Math.round(grid_pos % 1));
        if (Math.abs(dist) < 0.1) { pos.x = Math.round(grid_pos) * inc; }

        var inc = project.height / render_grid.divs;
        var grid_pos = pos.y / inc;
        var dist = grid_pos % 1 - (Math.round(grid_pos % 1));
        if (Math.abs(dist) < 0.1) { pos.y = Math.round(grid_pos) * inc; }
    }

    if (snap_guides) {
        for (var i = 0; i < render_grid.guide.length; i++) {
            var g = render_grid.guide[i];
            if (g.type == "vertical") {
                var dist = pos.x - g.x;
                if (Math.abs(dist) < 10) { pos.x = g.x; }
            }
            if (g.type == "horizontal") {
                var dist = pos.y - g.y;
                if (Math.abs(dist) < 10) { pos.y = g.y; }
            }
        }
    }

    if (snap_objects) {
        for (var i = 0; i < mz_window.length; i++) {
            var win = mz_window[i];
            if (!win.visible) { continue; }
            var layer_is_selected = false;
            for (var j = 0; j < layers.selected_layers.length; j++) {
                if (layers.selected_layers[j].render_object == win) { layer_is_selected = true; break; }
            }
            if (layer_is_selected) { continue; }

            var x1 = win.x;
            var x2 = win.x + win.width;
            var y1 = win.y;
            var y2 = win.y + win.height;
            if (pos.x > x1 && pos.x < x2) {
                var dist = pos.y - y1;
                if (Math.abs(dist) < 10) { pos.y = y1; }
                var dist = pos.y - y2;
                if (Math.abs(dist) < 10) { pos.y = y2; }
            }
            if (pos.y > y1 && pos.y < y2) {
                var dist = pos.x - x1;
                if (Math.abs(dist) < 10) { pos.x = x1; }
                var dist = pos.x - x2;
                if (Math.abs(dist) < 10) { pos.x = x2; }
            }
        }
    }
    
    return pos;
}

function mouseInArea(mouse_x, mouse_y, area) {
    if (mouse_x > area.left && mouse_x < area.right) {
        if (mouse_y > area.top && mouse_y < area.bottom) {
            return true;
        }
    }
    return false;
}

function mouseInStageArea(mouse_x, mouse_y) {
    if (mouse_x < 83) { return false; }

    var area = layers.window_layers.getBoundingClientRect();
    var new_area = {};
    new_area.left = area.left - 12;
    new_area.right = area.right;
    new_area.top = area.top;
    new_area.bottom = area.bottom + 10000;

    if (mouseInArea(mouse_x, mouse_y, new_area)) { return false; }
    if (mouse_y < 80) { return false; }
    var area = document.getElementById("snap_bar").getBoundingClientRect();
    if (mouseInArea(mouse_x, mouse_y, area)) { return false; }
    return true;
}

function mouseInMZWindow(mouse_x, mouse_y) {
    for (var i = 0; i < mz_window.length; i++) {
        if (!mz_window[i].visible) { continue; }
        var xx = mz_window[i].x + stage.x;
        var x2 = mz_window[i].x + mz_window[i].width + stage.x;
        var yy = mz_window[i].y + stage.y;
        var y2 = mz_window[i].y + mz_window[i].height + stage.y;
        //console.log(mouse_x, mouse_y);
        if (mouse_x > xx && mouse_x < x2 && mouse_y > yy && mouse_y < y2) {
            return mz_window[i];
        }
    }
    return 0;
}

function mouseOnGuide(mouse_x, mouse_y) {
    var xx = mouse_x - stage.x;
    var yy = mouse_y - stage.y;
    for (var i = 0; i < render_grid.guide.length; i++) {
        var g = render_grid.guide[i];
        if (g.type == "vertical") {
            if (Math.abs(xx - g.x) < 10) { return g; }
        }
        if (g.type == "horizontal") {
            if (Math.abs(yy - g.y) < 10) { return g; }
        }
    }

    return null;
}

function windowsInBox(x1, y1, x2, y2) {
    var windows = [];
    for (var i = 0; i < mz_window.length; i++) {
        if (!mz_window[i].visible) { continue; }
        var wx1 = mz_window[i].x;
        var wx2 = mz_window[i].x + mz_window[i].width;
        var wy1 = mz_window[i].y;
        var wy2 = mz_window[i].y + mz_window[i].height;
        //console.log(mouse_x, mouse_y);
        if (x1 > wx1 && x1 < wx2 && y2 > wy1 && y1 < wy1) { windows.push(i); continue; }
        if (x1 > wx1 && x1 < wx2 && y2 < wy2 && y1 > wy2) { windows.push(i); continue; }
        if (y1 > wy1 && y1 < wy2 && x2 > wx1 && x1 < wx1) { windows.push(i); continue; }
        if (y1 > wy1 && y1 < wy2 && x2 < wx2 && x1 > wx2) { windows.push(i); continue; }

        if (x2 < wx2 && y2 < wy2 && x1 > wx2 && y1 > wy2) { windows.push(i); continue; }
        if (x2 < wx2 && y2 > wy1 && x1 > wx2 && y1 < wy2) { windows.push(i); continue; }
        if (x2 > wx1 && y2 < wy2 && x1 < wx1 && y1 > wy2) { windows.push(i); continue; }
        if (x2 > wx1 && y2 > wy1 && x1 < wx1 && y1 < wy2) { windows.push(i); continue; }
    }
    return windows;
}

function checkMouseOut(e, element) {
    if (e.relatedTarget == null) { return true; }
    if (e.relatedTarget == element) { return false; }
    if (e.relatedTarget.parentElement == element) { return false; }
    if (e.relatedTarget.parentElement.parentElement == element) { return false; }
    return true;
}

function resetMouseState() {
    mouse_state.type = "";
    mouse_state.offset_x = 0;
    mouse_state.offset_y = 0;
    mouse_state.layer = null;
    mouse_state.layerheight = 0;
    mouse_state.spacer = 0;
    mouse_state.interaction = null;
    mouse_state.on_drag_start = false;
    mouse_state.nest_mode = false;
}

/*
function array_move(arr, old_index, new_index) {
    if (new_index >= arr.length) {
        var k = new_index - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr; // for testing
};
*/

// ------------------------------------------------------------
// Input manager system to handle keys and shortcuts
// ------------------------------------------------------------
function inputManager() {
    this.initialize(...arguments);
}

inputManager.prototype.initialize = function() {
    this.key_list = [];
    this.key_ctrl = -1;
    this.registerDefaultKeys();
}

inputManager.prototype.addKey = function(type, value) {
    this.key_list.push(registerKey(type, value));
    //console.log(this.key_list);
    return this.key_list.length-1;
}

inputManager.prototype.getKey = function(value) {
    for (var i = 0; i < this.key_list.length; i++) {
        var key = this.key_list[i];
        if (key.value == value) return i;
    }
}

inputManager.prototype.registerPressFunction = function(value, func) {
    var index = this.getKey(value);
    this.key_list[index].press_func = function() {
        func(value);
    }
    this.key_list[index].press = () => {
        this.key_list[index].press_func();
    };
}

inputManager.prototype.registerReleaseFunction = function(value, func) {
    var index = this.getKey(value);
    this.key_list[index].release_func = function() {
        func(value);
    }
    this.key_list[index].release = () => {
        this.key_list[index].release_func();
    };
}

inputManager.prototype.registerHoldFunction = function(value, func) {
    var index = this.getKey(value);
    this.key_list[index].hold_func = function() {
        func(value);
    }
}

inputManager.prototype.clearFunctions = function(value) {
    var key_index = this.getKey(value);
    this.key_list[key_index].press_func = undefined;
    this.key_list[key_index].release_func = undefined;
    this.key_list[key_index].hold_func = undefined;
    this.key_list[key_index].unsubscribe();
}

inputManager.prototype.update = function() {
    for (var i = 0; i < this.key_list.length; i++) {
        var key = this.key_list[i];
        if (key.isDown && !key.isUp) {
            if (key.hold_func) {
                key.hold_func(key.value);
            }
        }
    }
    mouseHoverCheck();
}

inputManager.prototype.isPressed = function(key) {
    return this.key_list[key].isDown;
}

inputManager.prototype.registerDefaultKeys = function() {
    this.addKey("keyboard", "a");
    this.registerPressFunction("a", keyPressTest);
    this.registerHoldFunction("a", keyPressTest);

    this.addKey("keyboard", "s");
    this.registerPressFunction("s", keyPressTest);

    this.addKey("keyboard", "d");
    this.registerPressFunction("d", keyPressTest);

    this.key_ctrl = this.addKey("keyboard", "Control");
    this.registerHoldFunction("Control", ctrlHold);
    this.registerReleaseFunction("Control", ctrlRelease);

    this.key_delete = this.addKey("keyboard", "Delete");
    this.registerPressFunction("Delete", delPress);

    this.key_shift = this.addKey("keyboard", "Shift");
    this.registerHoldFunction("Shift", shiftHold);
    this.registerReleaseFunction("Shift", shiftRelease);

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

    this.addKey("mouse", 0);
    this.registerPressFunction(0, mbLeftPress);
    this.registerHoldFunction(0, mbLeftHold);
    this.registerReleaseFunction(0, mbLeftRelease);
}
// ------------------------------------------------------------

/*
function registerDefaultKeys() {
    input.addKey("keyboard", "a");
    input.registerPressFunction("a", keyPressTest);
    input.registerHoldFunction("a", keyPressTest);

    input.addKey("keyboard", "s");
    input.registerPressFunction("s", keyPressTest);

    input.addKey("keyboard", "d");
    input.registerPressFunction("d", keyPressTest);

    input.addKey("keyboard", "Control");
    input.registerHoldFunction("Control", ctrlHold);
    input.registerReleaseFunction("Control", ctrlRelease);

    input.addKey("mouse", 1);
    input.registerPressFunction(1, mbMiddlePress);
    input.registerHoldFunction(1, mbMiddleHold);

    input.addKey("mouse", 0);
    input.registerPressFunction(0, mbLeftPress);
    input.registerHoldFunction(0, mbLeftHold);
    input.registerReleaseFunction(0, mbLeftRelease);
}*/

function keyPressTest(key) {
    //console.log("Key " + key + " pressed!");
}

function mouseHoverCheck() {
    if (tool_selected == "btn_tool_move" && mouse_state.type == "" && layers.selected_layers.length > 0) {
        var mouse_pos = renderer.plugins.interaction.mouse.global;

        render_grid.handleHover(mouse_pos.x, mouse_pos.y);
        render_grid.setControlSprites();
    }
}

function arrowLeftPress() {
    for (var i = 0; i < layers.selected_layers.length; i++) {
        var win = layers.selected_layers[i].render_object;
        if (!win.visible) { continue; }
        win.move(win.x - 10, win.y);
        render_grid.refreshSelection();
    }
}

function arrowRightPress() {
    for (var i = 0; i < layers.selected_layers.length; i++) {
        var win = layers.selected_layers[i].render_object;
        if (!win.visible) { continue; }
        win.move(win.x + 10, win.y);
        render_grid.refreshSelection();
    }
}

function arrowUpPress() {
    for (var i = 0; i < layers.selected_layers.length; i++) {
        var win = layers.selected_layers[i].render_object;
        if (!win.visible) { continue; }
        win.move(win.x, win.y - 10);
        render_grid.refreshSelection();
    }
}

function arrowDownPress() {
    for (var i = 0; i < layers.selected_layers.length; i++) {
        var win = layers.selected_layers[i].render_object;
        if (!win.visible) { continue; }
        win.move(win.x, win.y + 10);
        render_grid.refreshSelection();
    }
}

function ctrlHold() {
    if (mouse_state.type == "layer_drag" && mouse_state.layer.depth > 0) {
        mouse_state.nest_mode = true;
    }
    if (mouse_state.type == "") {
        mouse_state.type = "multi_select";
    }
}

function ctrlRelease() {
    if (mouse_state.type == "layer_drag") {
        mouse_state.nest_mode = false;
        mouse_state.over_layer.updateSelected();
        mouse_state.over_layer = null;
    }
    if (mouse_state.type == "multi_select") {
        mouse_state.type = "";
    }
}

function shiftHold() {
    if (mouse_state.type == "") {
        mouse_state.type = "shift_select";
    }
}

function shiftRelease() {
    if (mouse_state.type == "shift_select") {
        mouse_state.type = "";
    }
}

function delPress() {
    deleteLayer();
    render_grid.deleteSelectedGuides();
}

function mbMiddlePress() {
    mouse_state.type = "mb_middle";
    mouse_state.x = renderer.plugins.interaction.mouse.global.x;
    mouse_state.y = renderer.plugins.interaction.mouse.global.y;
    mouse_state.stage_x = stage.x;
    mouse_state.stage_y = stage.y;
}

function mbMiddleHold() {
    var mouse_pos = renderer.plugins.interaction.mouse.global;
    var diff_x = mouse_pos.x - mouse_state.x;
    var diff_y = mouse_pos.y - mouse_state.y;
    stage.x = mouse_state.stage_x + diff_x;
    stage.y = mouse_state.stage_y + diff_y;
}

function mbLeftPress() {
    if (mouse_state.type == "guide_move") { return; }
    mouse_state.x = renderer.plugins.interaction.mouse.global.x;
    mouse_state.y = renderer.plugins.interaction.mouse.global.y;
    if (tool_selected == "btn_tool_move" && mouseInStageArea(mouse_state.x, mouse_state.y)) {
        if (render_grid.handle_hover != -1) {
            mouse_state.type = "window_resize";
            render_grid.selection_previous.x1 = render_grid.handle[render_grid.handle_hover].position.x;
            render_grid.selection_previous.y1 = render_grid.handle[render_grid.handle_hover].position.y;
            mouse_state.offset_x = (mouse_state.x - stage.x) - render_grid.selection_previous.x1;
            mouse_state.offset_y = (mouse_state.y - stage.y) - render_grid.selection_previous.y1;
            switch(render_grid.handle_hover) {
                case 0:
                    render_grid.selection_previous.x2 = render_grid.handle[7].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[7].position.y;
                    break;
                case 1:
                    render_grid.selection_previous.x2 = render_grid.handle[render_grid.handle_hover].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[6].position.y;
                    break;
                case 2:
                    render_grid.selection_previous.x2 = render_grid.handle[5].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[5].position.y;
                    break;
                case 3:
                    render_grid.selection_previous.x2 = render_grid.handle[4].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[render_grid.handle_hover].position.y;
                    break;
                case 4:
                    render_grid.selection_previous.x2 = render_grid.handle[3].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[render_grid.handle_hover].position.y;
                    break;
                case 5:
                    render_grid.selection_previous.x2 = render_grid.handle[2].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[2].position.y;
                    break;
                case 6:
                    render_grid.selection_previous.x2 = render_grid.handle[render_grid.handle_hover].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[1].position.y;
                    break;
                case 7:
                    render_grid.selection_previous.x2 = render_grid.handle[0].position.x;
                    render_grid.selection_previous.y2 = render_grid.handle[0].position.y;
                    break;
            }
            for (var i = 0; i < layers.selected_layers.length; i++) {
                var obj = layers.selected_layers[i].render_object;
                obj.previous_x = obj.x;
                obj.previous_y = obj.y;
                obj.previous_w = obj.width;
                obj.previous_h = obj.height;
            }
            return;
        }

        var obj = mouseInMZWindow(mouse_state.x, mouse_state.y);
        // Clicked inside a visible window
        if (obj) {
            render_grid.deselectAllGuides();
            render_grid.drawGuides();
            console.log("Mouse in window: " + obj);
            if (mouse_state.type == "multi_select" || mouse_state.type == "shift_select") {
                layers.toggleSelectLayer(obj.parent_layer);
            } else {
                var already_selected = obj.parent_layer.selected;
                if (!already_selected) { 
                    layers.selectLayer(obj.parent_layer);
                    scrollLayers(obj.parent_layer.ui_element.offsetTop);
                }
                for (var i = 0; i < layers.selected_layers.length; i++) {
                    var obj = layers.selected_layers[i].render_object;
                    obj.off_x = mouse_state.x - stage.x - obj.x;
                    obj.off_y = mouse_state.y - stage.y - obj.y;
                }
                mouse_state.type = "window_move";
            }
        } else {
            layers.deselectAllLayers();
            var guide = mouseOnGuide(mouse_state.x, mouse_state.y);
            if (guide != null) {
                if (mouse_state.type != "multi_select" && mouse_state.type != "shift_select") { 
                    render_grid.deselectAllGuides(); 
                }
                guide.selected = true;
                mouse_state.type = "guide_move";
                mouse_state.interaction = render_grid.findGuideIndex(guide);
            } else {
                render_grid.deselectAllGuides();
                mouse_state.type = "selection_box";
            }
            render_grid.drawGuides();
        }
    }
    if (tool_selected == "btn_tool_draw") {
        if (mouseInStageArea(mouse_state.x, mouse_state.y)) {
            var sp = getMouseStagePos();
            mouse_state.type = "window_draw";
            var new_window = new MZWindow();
            mz_window.push(new_window);
            new_window.move(sp.x, sp.y);
            mouse_state.x = sp.x + stage.x;
            mouse_state.y = sp.y + stage.y;

            var layer = new layerWindow(new_window);
            layers.active_scene.add(layer);
            layer.scene_layer = layers.active_scene;
            layers.selectLayer(layer);

            render_grid.deselectAllGuides();
            render_grid.drawGuides();

            //console.log(layers.window_layers_content.scrollTop);
            //console.log(document.getElementsByClassName("simplebar-content-wrapper")[0].scrollTop);
            //document.getElementsByClassName("simplebar-content-wrapper")[0].scrollTop = 100000;
            timers.setTimer(timers.scroll_timer, 20);
        }
    }
}

function mbLeftHold() {
    var mouse_pos = renderer.plugins.interaction.mouse.global;
    if ( Math.abs(mouse_pos.x - mouse_state.x) + Math.abs(mouse_pos.y - mouse_state.y) > 10) {
        mouseDragStart(mouse_pos);
    }
    if (mouse_state.on_drag_start == true) {
        mouseDrag(mouse_pos);
    }

    if (mouse_state.type == "selection_box") {
        // Selection box to select multiple windows
        var x1 = mouse_state.x - stage.x;
        var y1 = mouse_state.y - stage.y;
        var x2 = mouse_pos.x - stage.x;
        var y2 = mouse_pos.y - stage.y;
        render_grid.drawDragSelection(x1, y1, x2, y2);
        layers.deselectAllLayers();
        var window_selection = windowsInBox(x1, y1, x2, y2);
        for (var i = 0; i < window_selection.length; i++) {
            var layer = mz_window[window_selection[i]].parent_layer;
            if (i == 0) { scrollLayers(layer.ui_element.offsetTop); }
            if (!layer.selected) { layers.toggleSelectLayer(layer); }
        }
    }

    if (mouse_state.type == "window_draw") {
        var sp = getMouseStagePos();
        var last_window = mz_window[mz_window.length-1]
        if (last_window) {
            var diff_x = sp.x - (mouse_state.x - stage.x);
            var diff_y = sp.y - (mouse_state.y - stage.y);
            if (diff_x < 0) {
                last_window.move(sp.x, last_window.y);
                diff_x = Math.abs(diff_x);
            }
            if (diff_y < 0) {
                last_window.move(last_window.x, sp.y);
                diff_y = Math.abs(diff_y);
            }
            last_window.resize(diff_x, diff_y);
            render_grid.refreshSelection();
        }
    }

    if (mouse_state.type == "window_resize") {
        var sp = getMouseStagePos();
        var bx, by, bw, bh, sx1, sy1, sx2, sy2, dist_x, dist_y;
        bx = render_grid.selection_previous.x1;
        by = render_grid.selection_previous.y1;
        bw = render_grid.selection_previous.x2 - bx;
        bh = render_grid.selection_previous.y2 - by;

        dist_x = sp.x - (mouse_state.x - stage.x) + mouse_state.offset_x;
        dist_y = sp.y - (mouse_state.y - stage.y) + mouse_state.offset_y;

        for (var i = 0; i < layers.selected_layers.length; i++) {
            var obj = layers.selected_layers[i].render_object;

            sx1 = normalize(obj.previous_x, bx, bx+bw);
            sy1 = normalize(obj.previous_y, by, by+bh);
            sx2 = normalize(obj.previous_x + obj.previous_w, bx, bx+bw);
            sy2 = normalize(obj.previous_y + obj.previous_h, by, by+bh);

            var x1 = obj.previous_x + dist_x * sx1;
            var y1 = obj.previous_y + dist_y * sy1;
            var x2 = obj.previous_x + obj.previous_w + (dist_x * sx2);
            var y2 = obj.previous_y + obj.previous_h + (dist_y * sy2);

            var nx = x1;
            var ny = y1;
            var nw = x2 - x1;
            var nh = y2 - y1;
            if (nw < 0) { nx = x2; nw = Math.abs(nw); }
            if (nh < 0) { ny = y2; nh = Math.abs(nh); }

            obj.move(nx, ny);
            obj.resize(nw, nh);
        }

        render_grid.refreshSelection();
    }

    if (mouse_state.type == "guide_move") {
        render_grid.moveGuide(mouse_state.interaction, Math.round(mouse_pos.x-stage.x), Math.round(mouse_pos.y-stage.y));
        render_grid.drawGuides();
    }

    if (mouse_state.type == "resize_panels_v") {
        var diff = mouse_state.x - mouse_pos.x;
        layers.resizePanels(diff, 0);
        //console.log(diff);
    }

    if (mouse_state.type == "resize_panels_h") {
        var diff = mouse_state.y - mouse_pos.y;
        layers.resizePanels(0, diff);
        //console.log(diff);
    }
}

// Runs once when you click and start dragging
function mouseDragStart(mouse_pos) {
    if (mouse_state.on_drag_start) { return; }
    if (mouse_state.type == "layer_drag") {
        mouse_state.layer.closeLayer();
        layers.updateLayerList();
        if (mouse_state.interaction) {
            var layer_clone = mouse_state.interaction.cloneNode(true);
            var child = layer_clone.childNodes;
            if (mouse_state.layer.depth == 0) {
                layer_clone.removeChild(child[2]);
                layer_clone.removeChild(child[3]);
            } else {
                //console.log(child);
                if (layers.selected_layers.length > 1) {
                    child[3].innerText = "Multiple Layers"
                }
                layer_clone.removeChild(child[2]);
                layer_clone.removeChild(child[3]);
                layer_clone.removeChild(child[3]);
                layer_clone.removeChild(child[3]);
            }
            //layer_clone.removeChild(child[1]);
            //if (child.length > 2) { layer_clone.removeChild(child[2]); }
            layer_clone.style.height = mouse_state.layer.height + "px";
            layer_clone.style.position = "absolute";
            layer_clone.style.width = layers.width + "px";
            layer_clone.style.borderRadius = "5px";
            layer_clone.style.left = mouse_pos.x + mouse_state.offset_x + "px";
            layer_clone.style.top = mouse_pos.y + mouse_state.offset_y + "px";
            layer_clone.style.backgroundColor = "#333a4c";
            layer_clone.style.opacity = "0.5";
            layer_clone.style.pointerEvents = "none";
            document.body.appendChild(layer_clone);
            mouse_state.interaction = layer_clone;
            if (layers.selected_layers.length < 2) { mouse_state.layer.startDragging(); }
            mouse_state.on_drag_start = true;
        }
    }
    mouse_state.on_drag_start = true;
}

function mouseDrag(mouse_pos) {
    if (mouse_state.type == "layer_drag") {
        var layer_clone = mouse_state.interaction;
        layer_clone.style.left = mouse_pos.x + mouse_state.offset_x + "px";
        layer_clone.style.top = mouse_pos.y + mouse_state.offset_y + "px";

        if (mouse_state.nest_mode == false) {
            var area = layers.window_layers.getBoundingClientRect();
            if (mouseInArea(mouse_pos.x, mouse_pos.y, area)) {
                layers.checkSpacers(mouse_pos.y);
                layers.updateLayerHeight();
            } else {
                mouse_state.spacer = null;
                layers.collapseSpacers();
                if (layers.selected_layers.length < 2) {
                    mouse_state.layer.ui_element.style.height = "0px";
                }

                layers.updateLayerHeight();
                if (mouse_state.layer.depth == 0) { return; }
                var p = mouse_state.layer.parent_layer;
                if (layers.selected_layers.length < 2) {
                    p.ui_element.style.height = p.height + p.content_height - parseInt(mouse_state.layerheight) + "px";
                } else {
                    p.ui_element.style.height = p.height + p.content_height + "px";
                }
            }
        } else {
            layers.collapseAll();
        }
    }

    if (mouse_state.type == "window_move") {
        var sp = getMouseStagePos();
        // Move windows around
        for (var i = 0; i < layers.selected_layers.length; i++) {
            var obj = layers.selected_layers[i].render_object;
            obj.move(sp.x - obj.off_x, sp.y - obj.off_y);
        }
        render_grid.refreshSelection();
    }
}

function mbLeftRelease() {
    if (mouse_state.type == "layer_drag") {
        if (mouse_state.on_drag_start == true) {
            if (mouse_state.spacer != null) {
                var parent = layers.spacers[mouse_state.spacer].element.parentElement;
                var layer = layers.getLayerObject(parent.parentElement);
                //layers.changeLayerPos(mouse_state.layer, parent, mouse_state.spacer);
                //console.log(layer);
                for (var i = layers.selected_layers.length-1; i >= 0; i--) {
                    layers.changeLayerPos(layers.selected_layers[i], layer.ui_contents, mouse_state.spacer);
                    console.log(parent);
                    //console.log(mouse_state.layer.parent_layer.ui_contents);
                }
                if (layers.selected_layers.length == 0) {
                    layers.changeLayerPos(mouse_state.layer, parent, mouse_state.spacer);
                }
                layers.refreshSpacers();
                //if (mouse_state.layer.depth > 0) { layers.selectLayer(mouse_state.layer); }
            }

            if (mouse_state.nest_mode) {
                var brrr = true;
                var target = mouse_state.over_layer;
                for (var i = 0; i < layers.selected_layers.length; i++) {
                    if (layers.selected_layers[i] == target) {
                        brrr = false;
                    }
                }
                if (brrr) {
                    for (var i = layers.selected_layers.length-1; i >= 0; i--) {
                        target.add(layers.selected_layers[i]);
                        layers.selected_layers[i].updateSelected();
                    }
                }
                console.log(target);
            }

            mouse_state.spacer = null;
            layers.updateLayerHeight();
            document.body.removeChild(mouse_state.interaction);
            mouse_state.layer.stopDragging();
            layers.collapseSpacers();
            if (mouse_state.over_layer != null) { mouse_state.over_layer.updateSelected(); }
        }
    }

    if (mouse_state.type == "window_draw") {
        mouse_state.type = "";
        render_grid.refreshSelection();
    }

    if (mouse_state.type == "selection_box") {
        render_grid.clearDragSelection();
    }

    if (mouse_state.type == "resize_panels_v" || mouse_state.type == "resize_panels_h") {
        layers.window_layers.style.transition = "height 0.2s ease-out";
        layers.window_properties.style.transition = "height 0.2s ease-out";
    }

    resetMouseState();
}

// ------------------------------------------------------------
// Project system to handle project-wide settings and data
// ------------------------------------------------------------
function projectSystem() {
    this.initialize(...arguments);
}

projectSystem.prototype.initialize = function() {
    this.name = "New Project";
    this.width = 816;
    this.height = 624;
}

projectSystem.prototype.setSize = function(w, h) {
    this.width = w;
    this.height = h;
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Grid system to generate a grid in pixi
// ------------------------------------------------------------
function gridSystem() {
    this.initialize(...arguments);
}

gridSystem.prototype.initialize = function() {
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

gridSystem.prototype.createControlSprites = function() {
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

gridSystem.prototype.setControlSprites = function() {
    for (var i = 0; i < 8; i++) {
        if (i == this.handle_hover) {
            this.handle[i].texture = sprite_sheet.textures["stage-control-handle-hover.png"];
        } else {
            this.handle[i].texture = sprite_sheet.textures["stage-control-handle.png"];
        }
    }
}

gridSystem.prototype.clearHandles = function() {
    for (var i = 0; i < 8; i++) {
        this.handle[i].visible = false;
    }
}

gridSystem.prototype.drawGrid = function() {
    // Draw the margin box
    if (this.margin_h > 0 || this.margin_v > 0) {
        var mh = this.margin_h/2;
        var mv = this.margin_v/2;
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
        this.grid.moveTo(inc*i, 0);
        this.grid.lineTo(inc*i, project.height);
    }
    // Draw horizontal lines
    for (i = 1; i < this.divs; i++) {
        inc = project.height / this.divs;
        this.grid.moveTo(0, inc*i);
        this.grid.lineTo(project.width, inc*i);
    }
}

gridSystem.prototype.drawGuides = function() {
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

gridSystem.prototype.drawSelection = function() {
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
    this.selection.drawRect(x1, y1, x2-x1, y2-y1);
    this.drawHandles(x1, y1, x2, y2);
}

gridSystem.prototype.getSelectionBounds = function() {
    var x1, y1, x2, y2;
    for (var i = 0; i < layers.selected_layers.length; i++) {
        var obj = layers.selected_layers[i].render_object;
        if (i == 0) { x1 = obj.x; y1 = obj.y; x2 = obj.x+obj.width; y2 = obj.y+obj.height; }
        else {
            if (obj.x < x1) { x1 = obj.x; }
            if (obj.y < y1) { y1 = obj.y; }
            if (obj.x+obj.width > x2) { x2 = obj.x+obj.width; }
            if (obj.y+obj.height > y2) { y2 = obj.y+obj.height; }
        }
    }
    this.selection_bounds.x1 = x1;
    this.selection_bounds.y1 = y1;
    this.selection_bounds.x2 = x2;
    this.selection_bounds.y2 = y2;
}

gridSystem.prototype.drawHandles = function(x1, y1, x2, y2) {
    var h = y2 - y1;
    var w = x2 - x1;
    var j = 0;
    var k = 0;
    for (var i = 0; i < this.handle.length; i++) {
        if (j == 1 && k == 1) { j++; }
        this.handle[i].position.x = x1 + j*(w/2);
        this.handle[i].position.y = y1 + k*(h/2);
        this.handle[i].visible = true;
        if (j < 2) { j++; } else { j = 0; k += 1; }
    }
}

gridSystem.prototype.handleHover = function(mx, my) {
    for (var i = 0; i < this.handle.length; i++) {
        if (Math.abs(mx - stage.x - this.handle[i].position.x) < 15 && Math.abs(my - stage.y - this.handle[i].position.y) < 15) {
            this.handle_hover = i;
            return i;
        }
    }
    this.handle_hover = -1;
    return -1;
}

gridSystem.prototype.refresh = function() {
    this.drawGrid();
    this.drawSelection();
}

gridSystem.prototype.refreshSelection = function() {
    this.drawSelection();
}

gridSystem.prototype.drawDragSelection = function(x1, y1, x2, y2) {
    this.drag_selection.clear();
    this.drag_selection.lineStyle(2, 0xff3466);
    this.drag_selection.drawRect(x1, y1, x2-x1, y2-y1);
}

gridSystem.prototype.clearDragSelection = function() {
    this.drag_selection.clear();
}

gridSystem.prototype.newGuide = function(type) {
    this.deselectAllGuides();

    var g = {};
    g.type = type;
    g.x = 0;
    g.y = 0;
    g.selected = true;

    this.guide.push(g);
    this.drawGuides();

    return this.guide.length-1;
}

gridSystem.prototype.moveGuide = function(index, xx, yy) {
    this.guide[index].x = xx;
    this.guide[index].y = yy;
}

gridSystem.prototype.selectGuide = function(index) {
    if (layers.selected_layers.length > 0) {
        layers.deselectAllLayers();
    }
    this.guide[index].selected = true;
}

gridSystem.prototype.findGuideIndex = function(guide) {
    for (var i = 0; i < this.guide.length; i++) {
        if (guide == this.guide[i]) { return i; }
    }
    
    return null;
}

gridSystem.prototype.deleteSelectedGuides = function() {
    for (var i = 0; i < this.guide.length; i++) {
        var g = this.guide[i];
        if (g.selected) {
            this.guide.splice(i, 1);
            i-=1;
        }
    }
    this.drawGuides();
}

gridSystem.prototype.deselectAllGuides = function() {
    for (var i = 0; i < this.guide.length; i++) {
        this.guide[i].selected = false;
    }
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Layer system for working with layers
// ------------------------------------------------------------
function layerSystem() {
    this.initialize(...arguments);
}

layerSystem.prototype.initialize = function() {
    this.width = 300;
    this.height = 400;
    this.temp_width = 0;
    this.temp_height = 0;
    this.scenes = [];
    this.spacers = [];
    this.layer_list = [];
    this.window_layers = null;
    this.window_layers_content = null;
    this.window_properties = null;
    this.window_properties_content = null;
    this.bottom = 0;
    this.active_scene = null;
    this.open = true;
    this.properties_open = true;
    this.selected_layers = [];

    this.btn_new_group = null;
    this.btn_new_scene = null;
    this.btn_delete_layer = null;

    this.grabby_vertical = null;
    this.grabby_horizontal = null;

    this.createUI();
}

layerSystem.prototype.addSceneLayer = function(layer) {
    this.scenes.push(layer);

    layer.parent_layer = this;
    layer.createUI(this.window_layers_content);
    //this.createSpacer(this.window_layers_content);

    for (var i = 0; i < layer.contents.length; i++) {
        layer.contents[i].createUI(layer.ui_element);
    }

    this.refreshSpacers();
    //this.window_layers_content.scrollTop(0);
    //console.log(this.spacers);
}

layerSystem.prototype.createUI = function() {
    var thisLayer = this;

    this.window_layers = uiCreateElement("window_layers", document.body);
    uiStyle("window_layers", "right", "26px", "top", "86px", this.width + "px", this.height + "px", "#1a1d2e");
    this.window_layers.style.borderRadius = "10px";
    this.window_layers.style.overflow = "hidden";
    this.window_layers.style.transition = "height 0.2s ease-out";

    var window_title_text = uiCreateElement("window_layers_title_text", this.window_layers);
    window_title_text.innerText = "LAYERS";
    uiStyleText("window_layers_title_text", "left", "24px", "top", "20px", "RBold", "14pt", "#a0aec0");

    var btn_window_layers = uiCreateButton("btn_window_layers", "layers-title-open.svg", null, this.window_layers);
    uiStyle("btn_window_layers", "right", "0px", "top", "0px", this.width + "px", "58px", "");
    uiStylePos("btn_window_layers_img", "right", "20px", "top", "20px");

    btn_window_layers.onclick = function(e) {
        thisLayer.toggleLayerWindow(e);
    }

    this.window_layers_content = uiCreateElement("window_layers_content", this.window_layers);
    uiStyle("window_layers_content", "left", "0px", "top", "58px", "100%", this.height - 58 - 49 + "px", "");
    new SimpleBar(this.window_layers_content);
    this.window_layers_content = document.getElementsByClassName("simplebar-content")[0];
    
    this.createSpacer(this.window_layers_content);

    // Bottom buttons
    this.btn_new_group = uiCreateButton("btn_new_group", "layers-new-group.svg", createNewGroup, this.window_layers);
    uiStyle("btn_new_group", "left", "14px", "top", this.height - 40 + "px", "28px", "28px", "");
    this.btn_new_group.style.transition = "top 0.0s ease-out";
    this.btn_new_scene = uiCreateButton("btn_new_scene", "layers-new-scene.svg", createNewScene, this.window_layers);
    uiStyle("btn_new_scene", "left", "46px", "top", this.height - 40 + "px", "28px", "28px", "");
    this.btn_new_scene.style.transition = "top 0.0s ease-out";
    this.btn_delete_layer = uiCreateButton("btn_delete_layer", "layers-delete.svg", deleteLayer, this.window_layers);
    uiStyle("btn_delete_layer", "right", "14px", "top", this.height - 40 + "px", "28px", "28px", "");
    this.btn_delete_layer.style.transition = "top 0.0s ease-out";

    // Properties panel
    var wh = window.innerHeight;
    this.window_properties = uiCreateElement("window_properties", document.body);
    uiStyle("window_properties", "right", "26px", "bottom", "68px", this.width + "px", wh - this.height - 172 + "px", "#1a1d2e");
    this.window_properties.style.borderRadius = "10px";
    this.window_properties.style.overflow = "hidden";
    this.window_properties.style.transition = "height 0.2s ease-out";

    var properties_text = uiCreateElement("properties_text", this.window_properties);
    properties_text.innerText = "PROPERTIES";
    uiStyleText("properties_text", "left", "24px", "top", "20px", "RBold", "14pt", "#a0aec0");

    var btn_properties = uiCreateButton("btn_properties", "layers-title-open.svg", null, this.window_properties);
    uiStyle("btn_properties", "right", "0px", "top", "0px", this.width + "px", "58px", "");
    uiStylePos("btn_properties_img", "right", "20px", "top", "20px");

    btn_properties.onclick = function(e) {
        thisLayer.togglePropertiesWindow(e);
    }

    this.window_properties_content = uiCreateElement("window_properties_content", this.window_properties);
    var wh = window.innerHeight;
    uiStyle("window_properties_content", "left", "0px", "top", "58px", "100%", wh - this.height - 172 - 58 + "px", "");
    new SimpleBar(this.window_properties_content);
    this.window_properties_content = document.getElementsByClassName("simplebar-content")[1];

    // Make the grabbies
    this.grabby_vertical = uiCreateElement("grabby_v", document.body);
    uiStyle("grabby_v", "right", 26 + this.width + "px", "top", "95px", "10px", "83%", "");
    var grabby_vertical_line = uiCreateElement("grabby_v_line", this.grabby_vertical);
    uiStyle("grabby_v_line", "left", "0px", "top", "0px", "1px", "100%", "#3b3e51");
    grabby_vertical_line.style.opacity = 0;
    grabby_vertical_line.style.transition = "opacity 0.2s ease-out";

    this.grabby_vertical.onmouseover = function(e) {
        grabby_vertical_line.style.opacity = 1;
    }
    this.grabby_vertical.onmouseleave = function(e) {
        grabby_vertical_line.style.opacity = 0;
    }
    this.grabby_vertical.onmousedown = function(e) {
        thisLayer.temp_width = thisLayer.width;
        thisLayer.temp_height = thisLayer.height;

        mouse_state.type = "resize_panels_v";
    }

    this.grabby_horizontal = uiCreateElement("grabby_h", document.body);
    uiStyle("grabby_h", "right", "26px", "top", this.height + 85 + "px", this.width + "px", "18px", "");
    var grabby_horizontal_line = uiCreateElement("grabby_h_line", this.grabby_horizontal);
    uiStyle("grabby_h_line", "left", "0px", "top", "50%", "100%", "1px", "#3b3e51");
    grabby_horizontal_line.style.opacity = 0;
    grabby_horizontal_line.style.transition = "opacity 0.2s ease-out";

    this.grabby_horizontal.onmouseover = function(e) {
        grabby_horizontal_line.style.opacity = 1;
    }
    this.grabby_horizontal.onmouseleave = function(e) {
        grabby_horizontal_line.style.opacity = 0;
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
    }
}

layerSystem.prototype.resizePanels = function(w, h) {
    var wh = window.innerHeight;
    var nw = clamp(this.temp_width + w, window.innerWidth/2, 200);
    var nh = clamp(this.temp_height - h, wh-327, 155);
    if (mouse_state.type == "resize_panels_v") {
        this.width = nw;
        this.window_layers.style.width = nw + "px";
        this.window_properties.style.width = nw + "px";
        this.grabby_vertical.style.right = nw + 26 + "px";
        this.grabby_horizontal.style.width = nw + "px";
    }
    if (mouse_state.type == "resize_panels_h") {
        this.height = nh;
        this.window_layers.style.height = nh + "px";
        this.grabby_horizontal.style.top = nh + 85 + "px";
        var content = document.getElementById("window_layers_content");
        content.style.height = nh - 58 - 49 + "px";
        this.btn_new_group.style.top = nh - 40 + "px";
        this.btn_new_scene.style.top = nh - 40 + "px";
        this.btn_delete_layer.style.top = nh - 40 + "px";
        this.window_properties.style.height = wh - nh - 172 + "px";
        var content = document.getElementById("window_properties_content");
        content.style.height = wh - nh - 172 - 58 + "px";
    }
}

layerSystem.prototype.toggleLayerWindow = function() {
    if (this.scenes.length > 0) {
        this.open = !this.open;
        if (!this.open && !this.properties_open) { this.properties_open = true; }
        this.updateOpen();
    }
}

layerSystem.prototype.togglePropertiesWindow = function() {
    this.properties_open = !this.properties_open;
    if (!this.properties_open && !this.open) { this.open = true; }
    this.updateOpen();
}

layerSystem.prototype.updateOpen = function() {
    var wh = window.innerHeight;
    this.window_layers.style.transition = "height 0.2s ease-out";
    this.window_properties.style.transition = "height 0.2s ease-out";
    this.btn_new_group.style.transition     = "top 0.2s ease-out";
    this.btn_new_scene.style.transition     = "top 0.2s ease-out";
    this.btn_delete_layer.style.transition  = "top 0.2s ease-out";
    if (this.open) {
        if (this.properties_open) {
            this.window_layers.style.height = this.height + "px";
            this.grabby_horizontal.style.top = this.height + 85 + "px";
            this.window_properties.style.height = wh - this.height - 172 + "px";
            var content = document.getElementById("window_layers_content");
            content.style.height = this.height - 58 - 49 + "px";
            var content = document.getElementById("window_properties_content");
            content.style.height = wh - this.height - 172 - 58 + "px";
            this.btn_new_group.style.top = this.height - 40 + "px";
            this.btn_new_scene.style.top = this.height - 40 + "px";
            this.btn_delete_layer.style.top = this.height - 40 + "px";
            replaceButtonImg("btn_properties", "layers-title-open.svg", true);
        } else {
            var nh = wh - 58 - 172;
            this.window_layers.style.height = nh + "px";
            this.window_properties.style.height = 58 + "px";
            this.grabby_horizontal.style.top = nh + 85 + "px";
            var content = document.getElementById("window_layers_content");
            content.style.height = nh - 58 - 49 + "px";
            this.btn_new_group.style.top = nh - 40 + "px";
            this.btn_new_scene.style.top = nh - 40 + "px";
            this.btn_delete_layer.style.top = nh - 40 + "px";
            replaceButtonImg("btn_properties", "layers-title-closed.svg", true);
        }
        replaceButtonImg("btn_window_layers", "layers-title-open.svg", true);
    } else {
        this.window_layers.style.height = "58px";
        this.grabby_horizontal.style.top = 58 + 85 + "px";
        this.window_properties.style.height = wh - 58 - 172 + "px";
        replaceButtonImg("btn_window_layers", "layers-title-closed.svg", true);
    }
}

layerSystem.prototype.createSpacer = function(parent) {
    var spacer = {};
    spacer.id = this.spacers.length;

    spacer.element = uiCreateElement("layer_spacer" + spacer.id, parent);
    uiStyle("layer_spacer" + spacer.id, "left", "0px", "top", "0px", "100%", "0px", "#292c3f");
    spacer.element.style.borderRadius = "5px";
    spacer.element.style.position = "relative";
    spacer.element.style.overflow = "hidden";
    spacer.element.style.transition = "height 0.1s ease-out";

    spacer.depth = 0;
    spacer.parent = this.getLayerObject(parent.parentElement);
    spacer.local_index = 0;

    this.spacers.push(spacer);
    return spacer;
}

layerSystem.prototype.selectScene = function(scene) {
    this.active_scene = scene;
    for (var i = 0; i < this.scenes.length; i++) {
        if (this.scenes[i].selected == true) {
            this.scenes[i].deselect();
        }
    }
    //this.deselectAllLayers();
    scene.select();
}

layerSystem.prototype.selectLayer = function(layer) {
    var s = this.getSceneLayer(layer);
    if (s != this.active_scene) { this.selectScene(s); }

    this.deselectAllLayers();
    this.selected_layers.push(layer);
    layer.select();

    render_grid.refreshSelection();
}

layerSystem.prototype.deselectAllLayers = function() {
    this.selected_layers = [];
    this.updateLayerList();
    for (var i = 0; i < this.layer_list.length; i++) {
        if (this.layer_list[i].depth != 0) {
            this.layer_list[i].deselect();
        }
    }
    render_grid.refreshSelection();
}

layerSystem.prototype.toggleSelectLayer = function(layer) {
    var index;
    for (var i = 0; i < this.selected_layers.length; i++) {
        if (this.selected_layers[i] == layer) {
            index = i;
            break;
        }
    }
    if (layer.selected) {
        layer.deselect();
        this.selected_layers.splice(index, 1);
    } else {
        if (layer.scene_layer != this.active_scene){
            this.deselectAllLayers();
            this.selectScene(layer.scene_layer);
        }
        layer.select();
        this.selected_layers.push(layer);
    }
    render_grid.refreshSelection();
}

layerSystem.prototype.layerIsSelected = function(layer) {
    for (var i = 0; i < this.selected_layers.length; i++) {
        if (this.selected_layers[i] == layer) {
            return true;
        }
    }
    return false;
}

layerSystem.prototype.getSceneLayer = function(layer) {
    while(layer.depth != 0) {
        layer = layer.parent_layer;
    }
    return layer;
}

layerSystem.prototype.checkSpacers = function(my) {
    var dist = 1000;
    var closest_spacer_index = null;
    for (var i = 0; i < this.spacers.length; i++) {
        var spacer = this.spacers[i];
        if (mouse_state.layer.depth == 0 && spacer.depth > 0) { continue; }
        if (mouse_state.layer.depth > 0 && spacer.depth == 0) { continue; }
        if (spacer.parent != null && spacer.parent.open == false) { continue; }
        var a = spacer.element.getBoundingClientRect();
        var h = a.bottom - a.top;
        if (h > 0 && my > a.top && my < a.bottom) { closest_spacer_index = i; dist = 0; break; }
        if (my < a.top) { var d = Math.abs(my - a.top); }
        else { var d = Math.abs(a.bottom - my); }
        if (d < dist) { dist = d; closest_spacer_index = i; }
    }

    if (closest_spacer_index == null) { return; }

    var la = mouse_state.layer.ui_element.getBoundingClientRect();
    var a = this.spacers[closest_spacer_index].element.getBoundingClientRect();
    if (Math.round(la.top) == Math.round(a.bottom) || Math.round(la.bottom) == Math.round(a.top)) {
        mouse_state.layer.ui_element.style.height = mouse_state.layerheight;
        this.collapseSpacers();
        mouse_state.spacer = null;
    } else {
        this.selectSpacer(closest_spacer_index);
        if (this.selected_layers.length < 2) { mouse_state.layer.ui_element.style.height = "0px"; }
        mouse_state.spacer = closest_spacer_index;
    }
}

layerSystem.prototype.selectSpacer = function(spacer) {
    this.spacers[spacer].element.style.height = mouse_state.layerheight;
    for (var i = 0; i < this.spacers.length; i++) {
        if (i != spacer) {
            this.spacers[i].element.style.height = "0px";
        }
    }
}

layerSystem.prototype.collapseSpacers = function() {
    for (var i = 0; i < this.spacers.length; i++) {
        this.spacers[i].element.style.height = "0px";
    }
}

layerSystem.prototype.collapseAll = function() {
    mouse_state.spacer = null;
    if (this.selected_layers.length < 2) {
        mouse_state.layer.ui_element.style.height = "0px"; 
    }
    this.collapseSpacers(); 
    this.updateLayerHeight();
    var p = mouse_state.layer.parent_layer;
    if (p == layers) { return; }
    if (this.selected_layers.length < 2) {
        p.ui_element.style.height = p.height + p.content_height - parseInt(mouse_state.layerheight) + "px";
    } else {
        p.ui_element.style.height = p.height + p.content_height + "px";
    }
    return; 
}

layerSystem.prototype.updateLayerHeight = function() {
    var layer = null;
    var sh = 0;
    if (mouse_state.spacer != null) {
        layer = this.spacers[mouse_state.spacer].parent;
        if (this.selected_layers.length > 1) {
            sh = mouse_state.layerheight;
        }
    }

    for (var i = 0; i < this.layer_list.length; i++) {
        if (this.layer_list[i] != mouse_state.layer && this.layer_list[i].open) {
            var h = this.layer_list[i].height + this.layer_list[i].content_height;
            this.layer_list[i].ui_element.style.height = h + "px";
        }
    }

    var p = mouse_state.layer.parent_layer;
    if (mouse_state.layer.depth > 0) { p.ui_element.style.height = p.height + p.content_height + sh + "px"; }
    if (layer != null && layer != p && layer.open) {
        //console.log(mouse_state.nest_mode);
        if (mouse_state.nest_mode) {
            if (this.selected_layers.length < 2) { layer.ui_element.style.height = "0px"; }
        } else {
            layer.ui_element.style.height = layer.height + layer.content_height + parseInt(mouse_state.layerheight) + "px";
        }
        if (this.selected_layers.length < 2) {
            p.ui_element.style.height = p.height + p.content_height - parseInt(mouse_state.layerheight) + "px";
        } else {
            p.ui_element.style.height = p.height + p.content_height + "px";
        }
    }
}

layerSystem.prototype.updateLayerList = function() {
    var check = [];
    this.layer_list = [];
    this.scenes.forEach(e => check.push(e));

    while (check.length > 0) {
        this.layer_list.push(check[0]);
        if (check[0].contents.length > 0) {
            check[0].contents.forEach(e => check.push(e));
        }
        check.splice(0, 1);
    }
}

layerSystem.prototype.getLayerObject = function(element) {
    var check = [];
    this.scenes.forEach(e => check.push(e));

    while (check.length > 0) {
        if (check[0].ui_element == element) {
            return check[0];
        }
        if (check[0].contents.length > 0) {
            check[0].contents.forEach(e => check.push(e));
        }
        check.splice(0, 1);
    }
    return null;
}

layerSystem.prototype.changeLayerPos = function(layer, parent, spacer) {
    if (spacer != null) {
        parent.insertBefore(layer.ui_element, this.spacers[spacer].element);

        var target_layer = this.getLayerObject(parent.parentElement);

        // Oof don't look at this! >_<
        var local_index = this.spacers[spacer].local_index;
        if (layer.parent_layer != layers) {
            for (var i = 0; i < layer.parent_layer.contents.length; i++) {
                if (layer.parent_layer.contents[i] == layer) {
                    layer.parent_layer.contents.splice(i, 1);
                    break;
                }
            }
            if (target_layer == layer) {
                if (i < local_index) { target_layer.contents.splice(local_index-1, 0, layer); }
                else { target_layer.contents.splice(local_index, 0, layer); }
            } else {
                target_layer.contents.splice(local_index, 0, layer);
            }
        } else {
            for (var i = 0; i < layers.scenes.length; i++) {
                if (layers.scenes[i] == layer) {
                    layers.scenes.splice(i, 1);
                }
            }
            if (i < local_index) { layers.scenes.splice(local_index-1, 0, layer); }
            else { layers.scenes.splice(local_index, 0, layer); }
        }

        target_layer ? console.log(target_layer.contents) : console.log(layers.scenes);

        if (target_layer != null && target_layer != layer) {
            layer.transfer(target_layer);
            var get_scene_layer = layer;
            while(get_scene_layer.depth != 0) {
                get_scene_layer = get_scene_layer.parent_layer;
            }
            this.selectScene(get_scene_layer);
            layer.scene_layer = get_scene_layer;
        }

        this.spacers[spacer].local_index += 1;
        //this.refreshSpacers();
    }
}

layerSystem.prototype.findLayerIndex = function(layer) {
    var layers = layer.parent_layer.contents;
    for (var i = 0; i < layers.length; i++) {
        if (layers[i] == layer) {
            return i;
        }
    }
    return -1;
}

layerSystem.prototype.refreshSpacers = function() {
    for (var i = 0; i < this.spacers.length; i++) {
        this.spacers[i].element.remove();
    }

    this.spacers = [];
    this.insertSpacers();
    //console.log(this.spacers);
}

layerSystem.prototype.insertSpacers = function() {
    var layers = [this.window_layers_content];
    var nodes = [];
    while (layers.length > 0) {
        var depth = this.getSpacerDepth(layers[0]);
        nodes = layers[0].childNodes;
        for (var i = 0; i < nodes.length; i+=2) {
            var spacer = this.createSpacer(layers[0]);
            spacer.depth = depth;
            spacer.local_index = i/2;
            //console.log(spacer.local_index);
            layers[0].insertBefore(spacer.element, nodes[i]);
            var childnodes = nodes[i+1].childNodes[0].childNodes;
            if (childnodes.length > 0) { layers.push(nodes[i+1].childNodes[0]) }
            else if (depth == 0) {
                var spacer = this.createSpacer(nodes[i+1].childNodes[0]);
                spacer.depth = 1;
            }
        }
        //var depth = this.getSpacerDepth(layers[0]);
        var spacer = this.createSpacer(layers[0]);
        spacer.depth = depth;
        spacer.local_index = i/2;
        //console.log(spacer.local_index);
        layers.splice(0, 1);
    }
}

layerSystem.prototype.getSpacerDepth = function(element) {
    var depth = 0;
    var root = this.window_layers_content;

    if (root == element) {return 0;}
    var parent = element.parentElement;
    while (parent != root) {
        depth += 1;
        parent = parent.parentElement;
    }
    return depth;
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Layer base for layer types like windows, scenes, and groups
// ------------------------------------------------------------
function layerBase() {
    this.initialize(...arguments);
}

var layer_id = 0;

layerBase.prototype.initialize = function() {
    this.name = "";
    this.contents = [];
    this.selected = false;
    this.toggle_function = null;
    this.layer_id = layer_id;
    layer_id += 1;
    this.depth = 0;
    this.parent_layer = null;

    this.height = 0;
    this.content_height = 0;
    this.hitbox = 0;
    this.ui_element = null;
    this.ui_arrow = null;
    this.ui_icon = null;
    this.ui_contents = null;
    this.ui_name = null;
    this.ui_depth = [];
    this.type = "";
    this.dragging = false;
    this.open = true;
    this.off_y = 0;
    this.render_object = null;
    this.hover = false;

    this.icon           = img_path + "layer-group-icon.svg";
    this.icon_hover     = img_path + "layer-group-icon.svg";
    //this.icon_edit      = img_path + "layer-group-icon.svg";
    this.icon_selected  = img_path + "layer-group-icon.svg";
    this.color          = "#4a5568";
    this.color_hover    = "#4a5568";
    this.color_edit     = "#4a5568";
    this.color_selected = "#4a5568";
    this.nav = img_path + "layer-nav-line-dim.svg";
    this.nav_hover = img_path + "layer-nav-line.svg";
}

layerBase.prototype.add = function(object) {
    this.contents.push(object);
    object.depth = this.depth + 1;
    object.parent_layer = this;
    object.createUI(this.ui_contents);

    for (var i = 0; i < object.contents.length; i++) {
        object.contents[i].depth = this.depth + 2;
        object.contents[i].parent_layer = object;
        object.contents[i].createUI(object.ui_contents);
    }

    this.open = true;
    this.updateOpen();
    layers.refreshSpacers();
}

layerBase.prototype.transfer = function(target_layer) {
    //var layer_index = this.parent_layer.findIndex(this);
    //this.parent_layer.contents.splice(layer_index, 1);
    //target_layer.contents.push(this);
    this.parent_layer.updateOpen();
    target_layer.updateOpen();
    this.updateAllButtons();
    this.updateSelected();
    this.parent_layer = target_layer;
}

layerBase.prototype.findIndex = function(object) {
    for (var i = 0; i < this.contents.length; i++) {
        if (this.contents[i] == object) { return i }
    }
    return -1;
}

layerBase.prototype.createUI = function(parent) {
    var thislayer = this;

    var id = this.layer_id;
    var offx = 22 * this.depth;
    var offy = this.off_y;

    this.ui_element = uiCreateElement("layer" + id, parent);
    uiStyle("layer" + id, "left", "0px", "top", "0px", "100%", this.height + this.content_height + "px", "#1a1d2e");
    this.ui_element.style.position = "relative";
    this.ui_element.style.overflow = "hidden";
    this.ui_element.style.transition = "height 0.1s ease-out";

    this.ui_contents = uiCreateElement("layer" + id + "contents", this.ui_element);
    uiStyle("layer" + id + "contents", "left", "0px", "top", this.height + "px", "100%", "0px", "");
    layers.createSpacer(this.ui_contents);

    this.ui_icon = createImage("layer" + id + "icon", this.base_icon);
    this.ui_element.appendChild(this.ui_icon);
    uiStyle("layer" + id + "icon", "left", offx + 47 + "px", "top", offy + 11 + "px", "23px", "23px", "");

    this.ui_arrow = uiCreateButton("layer" + id + "arrow", "layer-open.svg", null, this.ui_element);
    uiStyle("layer" + id + "arrow", "left", offx + 17 + "px", "top", offy + 11 + "px", "23px", "23px", "");

    this.ui_arrow.onclick = function(e) {
        thislayer.toggleLayer();
    }

    this.ui_name = uiCreateElement("layer" + id + "name", this.ui_element);
    this.ui_name.innerText = this.name;
    uiStyleText("layer" + id + "name", "left", offx + 82 + "px", "top", offy + 13 + "px", "RMed", "12pt", this.color);

    this.ui_element.onmousedown = function(e) {
        thislayer.mouseDownEvent(e);
    }
    this.ui_element.onmouseup = function(e) {
        thislayer.mouseUpEvent(e);
    }
    this.ui_element.onmouseover = function(e) {
        thislayer.mouseOverEvent(e);
    }
    this.ui_element.onmouseout = function(e) {
        if (checkMouseOut(e, thislayer.ui_element)) {
            thislayer.mouseOutEvent(e);
        }
    }

    for (var i = 0; i < this.depth; i++) {
        this.ui_depth[i] = createImage("layer" + id + "nav" + i, this.nav);
        this.ui_element.appendChild(this.ui_depth[i]);
        uiStyle("layer" + id + "nav" + i, "left", 18+(21*i) + "px", "top", "0px", "20px", "31px", "");
    }
}

layerBase.prototype.mouseDownEvent = function(e) {
    var element_pos = this.ui_element.getBoundingClientRect();
    if (e.clientY > element_pos.top + this.height) { return; }

    if (mouse_state.type == "") {
        mouse_state.type = "layer_drag";
        mouse_state.interaction = this.ui_element;
        mouse_state.layer = this;
        mouse_state.offset_x = -(e.clientX - element_pos.left);
        mouse_state.offset_y = -(e.clientY - element_pos.top);
        mouse_state.layerheight = this.height;
    }
}

layerBase.prototype.mouseUpEvent = function(e) {
    // If you're dragging, stop it!
}

layerBase.prototype.mouseOverEvent = function(e) {
    if (!this.hover) {
        this.hover = true;
        this.updateAllButtons();
    }
    if (!this.selected) {
        this.changeIcon(this.icon_hover);
        this.ui_name.style.color = this.color_hover;
    }
    if (mouse_state.nest_mode && this.depth != 0) {
        var element_pos = this.ui_element.getBoundingClientRect();
        if (e.clientY > element_pos.top + this.height) { return; }
        mouse_state.over_layer = this;
        this.ui_element.style.backgroundColor = "#333a4c";
    }
}

layerBase.prototype.mouseOutEvent = function(e) {
    if (this.hover) {
        this.hover = false;
        this.updateAllButtons();
    }
    if (!this.selected) {
        this.changeIcon(this.icon);
        this.ui_name.style.color = this.color;
    }
    if (mouse_state.nest_mode) {
        this.updateSelected();
    }
    //console.log("mlem");
}

layerBase.prototype.toggleLayer = function() {
   if (this.contents.length > 0) {
       this.open = !this.open;
       this.updateOpen();
   }
}

layerBase.prototype.openLayer = function() {
    if (this.open == false) {
        this.open = true;
        this.updateOpen();
    }
}

layerBase.prototype.closeLayer = function() {
    if (this.contents.length > 0) {
        this.open = false;
        this.updateOpen();
    }
}

layerBase.prototype.updateOpen = function() {
    this.updateAllButtons();
    if (this.open) {
        this.updateContentHeight();
        this.ui_element.style.height = this.height + this.content_height + "px";
    } else {
        this.ui_element.style.height = this.height + "px";
    }
}

layerBase.prototype.updateAllButtons = function() {
    this.updateButton("arrow", this.open, "layer-open", "layer-closed");
}

layerBase.prototype.updateButton = function(id, condition, img1, img2) {
    if (condition) {
        if (this.selected) {
            replaceButtonImg("layer" + this.layer_id + id, img1 + "-selected.svg", false);
        } else {
            if (this.hover) {
                replaceButtonImg("layer" + this.layer_id + id, img1 +"-hover.svg", false);
            } else {
                replaceButtonImg("layer" + this.layer_id + id, img1 + ".svg", false);
            }
        }
    } else {
        if (this.selected) {
            replaceButtonImg("layer" + this.layer_id + id, img2 + "-selected.svg", false);
        } else {
            if (this.hover) {
                replaceButtonImg("layer" + this.layer_id + id, img2 + "-hover.svg", false);
            } else {
                replaceButtonImg("layer" + this.layer_id + id, img2 + ".svg", false);
            }
        }
    }
}

layerBase.prototype.updateContentHeight = function() {
    var height = 0;
    for (var i = 0; i < this.contents.length; i++) {
        height += this.contents[i].height;
        if (this.contents[i].open) { height += this.contents[i].content_height; }
    }
    this.content_height = height;
}

layerBase.prototype.updateSelected = function() {
    this.updateAllButtons();
    this.ui_element.style.backgroundColor = "";
    if (this.selected) {
        this.changeIcon(this.icon_selected);
        this.ui_name.style.color = this.color_selected;
    } else {
        this.changeIcon(this.icon);
        this.ui_name.style.color = this.color;
    }
}

layerBase.prototype.changeHeight = function(height) {
    this.ui_element.style.height = height + "px";
}

layerBase.prototype.changeIcon = function(icon) {
    this.ui_icon.src = icon;
}

layerBase.prototype.changeName = function(name) {
    this.ui_name.innerText = name;
}

layerBase.prototype.select = function() {
    this.selected = true;
    this.updateSelected();
}

layerBase.prototype.deselect = function() {
    this.selected = false;
    this.updateSelected();
}

layerBase.prototype.startDragging = function() {
    this.dragging = true;
    var child = this.ui_element.childNodes;
    for (var i = 0; i < child.length; i++) {
        child[i].style.visibility = "hidden";
    }
    this.ui_element.style.backgroundColor = "#292c3f";
    this.ui_element.style.borderRadius = "5px";
}

layerBase.prototype.stopDragging = function() {
    this.dragging = false;
    var child = this.ui_element.childNodes;
    for (var i = 0; i < child.length; i++) {
        child[i].style.visibility = "visible";
    }
    this.ui_element.style.backgroundColor = "";
    this.ui_element.style.borderRadius = "0px";
    if (this.ui_element.style.height == "0px") { 
        this.ui_element.style.height = mouse_state.layerheight; 
    }
}

layerBase.prototype.destroy = function() {
    if (this.parent_layer != null) {
        var layer_index = this.parent_layer.findIndex(this);
        this.parent_layer.contents.splice(layer_index, 1);
        this.parent_layer.updateOpen();
    }
    this.ui_element.remove();
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Scene layer that can easily store other layers
// ------------------------------------------------------------
function layerScene() {
    this.initialize(...arguments);
}

var scene_layer_num = 0;

layerScene.prototype = Object.create(layerBase.prototype);
layerScene.prototype.constructor = layerScene;

layerScene.prototype.initialize = function() {
    layerBase.prototype.initialize.call(this);
    scene_layer_num += 1;

    this.icon           = img_path + "layer-scene-icon.svg";
    this.icon_hover     = img_path + "layer-scene-icon-hover.svg";
    this.icon_selected  = img_path + "layer-scene-icon-edit.svg";
    this.icon_edit      = img_path + "layer-edit-icon-selected.svg";
    this.color          = "#4a5568";
    this.color_hover    = "#6c7a8c";
    this.color_edit     = "#a0aec0";
    this.color_selected = "#a0aec0";

    this.ui_edit = null;
    this.type = "Scene Layer";
    this.name = "Scene " + scene_layer_num;
    this.height = 44;
    this.content_height = 0;
}

layerScene.prototype.createUI = function(parent) {
    layerBase.prototype.createUI.call(this, parent);
    this.changeHeight(this.height);
    this.changeIcon(this.icon);
    this.changeName(this.name);

    var id = this.layer_id;
    this.ui_edit = createImage("layer" + id + "edit", this.icon_edit);
    this.ui_element.appendChild(this.ui_edit);
    uiStyle("layer" + id + "edit", "right", "24px", "top", "11px", "23px", "23px", "");
    this.ui_edit.style.visibility = "hidden";
}

layerScene.prototype.mouseDownEvent = function(e) {
    layerBase.prototype.mouseDownEvent.call(this, e);

    var element_pos = this.ui_element.getBoundingClientRect();
    if (e.clientY > element_pos.top + this.height) { return; }
    layers.selectScene(this);
    layers.deselectAllLayers();
}

layerScene.prototype.updateSelected = function() {
    layerBase.prototype.updateSelected.call(this);
    if (this.selected) {
        this.ui_edit.style.visibility = "visible";
    } else {
        this.ui_edit.style.visibility = "hidden";
    }
}

layerScene.prototype.select = function() {
    layerBase.prototype.select.call(this);

    var layers = this.getAllLayers();
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].render_object != null) {
            if (layers[i].visible) {
                layers[i].render_object.unhide();
            }
        }
    }
}

layerScene.prototype.deselect = function() {
    layerBase.prototype.deselect.call(this);

    var layers = this.getAllLayers();
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].render_object != null) {
            layers[i].render_object.hide();
        }
    }
}

layerScene.prototype.getAllLayers = function() {
    var check = [];
    var layer_list = [];
    this.contents.forEach(e => check.push(e));

    while (check.length > 0) {
        layer_list.push(check[0]);
        if (check[0].contents.length > 0) {
            check[0].contents.forEach(e => check.push(e));
        }
        check.splice(0, 1);
    }
    //console.log(layer_list);
    return layer_list;
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Window layer that can easily store text and images
// ------------------------------------------------------------
function layerWindow(render_object) {
    this.initialize(...arguments);
}

var window_layer_num = 0;

layerWindow.prototype = Object.create(layerBase.prototype);
layerWindow.prototype.constructor = layerWindow;

layerWindow.prototype.initialize = function(render_object) {
    layerBase.prototype.initialize.call(this);
    window_layer_num += 1;

    this.icon          = img_path + "layer-window-icon.svg";
    this.icon_hover    = img_path + "layer-window-icon-hover.svg";
    this.icon_edit     = img_path + "layer-window-icon-edit.svg";
    this.icon_selected = img_path + "layer-window-icon-selected.svg";
    this.color          = "#333a4c";
    this.color_hover    = "#4a5568";
    this.color_selected = "#e2e8f0";
    this.icon_eye_open   = img_path + "layer-visible.svg";
    this.icon_eye_closed = img_path + "layer-invisible.svg";
    this.icon_locked     = img_path + "layer-locked.svg";
    this.icon_unlocked   = img_path + "layer-unlocked.svg";

    this.type = "Window Layer";
    this.name = "Window " + window_layer_num;
    this.height = 31;
    this.off_y = -7;
    this.render_object = render_object;
    render_object.parent_layer = this;
    this.scene_layer = null;

    this.visible = true;
    this.locked = false;
}

layerWindow.prototype.createUI = function(parent) {
    layerBase.prototype.createUI.call(this, parent);
    this.changeHeight(this.height);
    this.changeIcon(this.icon);
    this.changeName(this.name);

    var id = this.layer_id;
    var thislayer = this;
    this.ui_visible = uiCreateButton("layer" + id + "eye", "layer-visible.svg", null, this.ui_element);
    uiStyle("layer" + id + "eye", "right", 23 + "px", "top", 5 + "px", "23px", "23px", "");

    this.ui_visible.onclick = function(e) {
        thislayer.toggleHide();
    }

    this.ui_lock = uiCreateButton("layer" + id + "lock", "layer-unlocked.svg", null, this.ui_element);
    uiStyle("layer" + id + "lock", "right", 45 + "px", "top", 6 + "px", "23px", "23px", "");

    this.ui_lock.onclick = function(e) {
        thislayer.toggleLock();
    }
}

layerWindow.prototype.toggleHide = function() {
    // Blep
    this.visible = !this.visible;
    this.updateAllButtons();

    if (this.render_object != null) {
        this.visible ? this.render_object.unhide() : this.render_object.hide();
    }
}

layerWindow.prototype.toggleLock = function() {
    // Mlem
    this.locked = !this.locked;
    this.updateAllButtons();
}

layerWindow.prototype.addRenderObject = function(object) {
    this.render_object = object;
}

layerWindow.prototype.mouseDownEvent = function(e) {
    var element_pos = this.ui_element.getBoundingClientRect();
    if (e.clientY > element_pos.top + this.height) { return; }
    
    if (mouse_state.type == "multi_select") {
        layers.toggleSelectLayer(this);
        //console.log(layers.selected_layers)
    }
    
    if (mouse_state.type == "shift_select") {
        if (layers.selected_layers.length > 0) {
            var last_layer = layers.selected_layers[layers.selected_layers.length-1];
            if (last_layer.parent_layer != this.parent_layer) { 
                layers.deselectAllLayers();
                layers.selectLayer(this);
                layerBase.prototype.mouseDownEvent.call(this, e);
                return;
            }
            layers.deselectAllLayers();
            var last_index = layers.findLayerIndex(last_layer);
            var this_index = layers.findLayerIndex(this);
            if (this_index < last_index) {
                var temp = last_index;
                last_index = this_index;
                this_index = temp;
            }
            console.log(last_index, this_index);
            for (var i = last_index; i < this_index + 1; i++) {
                layers.toggleSelectLayer(this.parent_layer.contents[i]);
            }
        } else {
            layers.selectLayer(this);
        }
    }

    if (mouse_state.type != "multi_select" && mouse_state.type != "shift_select") {
        if (!layers.layerIsSelected(this)) {
            layers.selectLayer(this);
        }
    }
    
    layerBase.prototype.mouseDownEvent.call(this, e);
}

layerWindow.prototype.updateAllButtons = function() {
    layerBase.prototype.updateAllButtons.call(this);
    this.updateButton("eye", this.visible, "layer-visible", "layer-invisible");
    this.updateButton("lock", this.locked, "layer-locked", "layer-unlocked");
}

layerWindow.prototype.updateSelected = function() {
    layerBase.prototype.updateSelected.call(this);
    if (this.selected) {
        this.ui_element.style.backgroundColor = "#333a4c";
    } else {
        this.ui_element.style.backgroundColor = "#1a1d2e";
    }
}

layerWindow.prototype.stopDragging = function() {
    layerBase.prototype.stopDragging.call(this);
    if (this.selected) {
        this.ui_element.style.backgroundColor = "#333a4c";
    }
}

layerWindow.prototype.updateButtons = function(hover) {
    if (this.selected && this.visible) {
        this.ui_visible.src = this.icon_eye_open.split(".")[0] + "-selected.svg";
    }
}

layerWindow.prototype.destroy = function() {
    this.render_object.destroy();
    layerBase.prototype.destroy.call(this);
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// MZ Window system
// ------------------------------------------------------------
function MZWindow() {
    this.initialize(...arguments);
}

MZWindow.prototype.initialize = function() {
    this.x = 0;
    this.y = 0;
    this.off_x = 0;
    this.off_y = 0;
    this.previous_x = 0;
    this.previous_y = 0;
    this.previous_w = 0;
    this.previous_h = 0;
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
};

MZWindow.prototype.move = function(x, y) {
    this.container.x = x;
    this.container.y = y;
    this.x = x;
    this.y = y;
}

MZWindow.prototype.resize = function(w, h) {
    this.width = w;
    this.height = h;
    this.drawBack();
}

MZWindow.prototype.destroy = function() {
    this.container.parent.removeChild(this.container);
    const options = { children: true, texture: true };
    this.container.destroy(this.container, options);
    for (var i = 0; i < mz_window.length; i++) {
        if (mz_window[i] == this) {
            mz_window.splice(i, 1);
        }
    }
};

MZWindow.prototype.drawBack = function() {
    this.backSprite.clear();

    // Test box (kill this guy later)
    //this.backSprite.lineStyle(2, 0x3b3e51);
    this.backSprite.alpha = 0.3;
    this.backSprite.beginFill(0x3b3e51);
    this.backSprite.drawRect(0, 0, this.width, this.height);
    this.backSprite.endFill();
}

MZWindow.prototype.addChild = function(child) {
    this.container.addChild(child);
}

MZWindow.prototype.hide = function() {
    this.container.visible = false;
    this.visible = false;
}

MZWindow.prototype.unhide = function() {
    this.container.visible = true;
    this.visible = true;
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Property System
// ------------------------------------------------------------
function propertySystem() {
    this.initialize(...arguments);
}

propertySystem.prototype.initialize = function() {
    this.properties = [];
}
// ------------------------------------------------------------

// ------------------------------------------------------------
// Timer System
// ------------------------------------------------------------
function timerSystem() {
    this.initialize(...arguments);
}

timerSystem.prototype.initialize = function() {
    this.timers = [];

    var scrollTimerDuring = function() {
        scrollLayers(100000);
    }
    this.scroll_timer = this.newTimer(scrollTimerDuring, null);
}

timerSystem.prototype.newTimer = function(during_func, end_func) {
    var timer = {};
    timer.during = during_func;
    timer.end = end_func;
    timer.time = 0;
    this.timers.push(timer);
    return this.timers.length-1;
}

timerSystem.prototype.setTimer = function(timer, time) {
    this.timers[timer].time = time;
}

timerSystem.prototype.updateTimers = function() {
    for (var i = 0; i < this.timers.length; i++) {
        var timer = this.timers[i];
        if (timer.time > 0) {
            if (timer.time - 1 == 0) { if (timer.end) { timer.end(); } }
            else if (timer.during) { timer.during(); }
            timer.time -= 1;
        }
    }
}

// Handle input
/*
function registerKeys() {
    var a_key = registerKey("keyboard", "a");
    var mb_left = registerKey("mouse", 0);
    var mb_middle = registerKey("mouse", 1);

    a_key.press = () => {
        console.log("Key A was pressed!");
    };
    
    a_key.release = () => {
        console.log("Key A was released!");
    };

    mb_left.press = () => {
        console.log("Left mouse button was pressed!");
    }

    mb_middle.press = () => {
        console.log("Middle mouse button was pressed!");
        var mousePosition = renderer.plugins.interaction.mouse.global;
        console.log(mousePosition);
    }
}*/



// Make buttons and menu bars
function createUI() {
    // Pixi workspace
    var workspace = uiCreateElement("workspace", document.body);
    uiStyle("workspace", "left", "0px", "top", "0px", "100%", "100%", "");

    // Title bar
    var titlebar = uiCreateElement("titlebar", document.body);
    uiStyle("titlebar", "left", "0px", "top", "0px", "100%", "56px", "");
    titlebar.style.webkitAppRegion = "drag";

    var btnClose = uiCreateButton("btn_close", "titlebar-close.svg", closeWindow, document.body);
    uiStyle("btn_close", "right", "10px", "top", "10px", "37px", "37px", "");

    var btnMax = uiCreateButton("btn_max", "titlebar-max.svg", maximizeWindow, document.body);
    uiStyle("btn_max", "right", "50px", "top", "10px", "37px", "37px", "");

    var btnMin = uiCreateButton("btn_min", "titlebar-min.svg", minimizeWindow, document.body);
    uiStyle("btn_min", "right", "90px", "top", "10px", "37px", "37px", "");

    var btnSettings = uiCreateButton("btn_settings", "titlebar-settings.svg", openSettings, document.body);
    uiStyle("btn_settings", "right", "160px", "top", "10px", "37px", "37px", "");

    var btnMenu = uiCreateButton("btn_menu", "titlebar-menu.svg", openMenu, document.body);
    uiStyle("btn_menu", "left", "90px", "top", "10px", "37px", "37px", "");

    var titleText = uiCreateElement("title_text", document.body);
    titleText.innerText = "New Project / Scene 1";
    uiStyleText("title_text", "left", "138px", "top", "17px", "RBold", "15pt", "#e2e8f0");

    // Toolbar
    var toolbar = uiCreateElement("toolbar", document.body);
    uiStyle("toolbar", "left", "0px", "top", "0px", sidebar_width + "px", "100%", "#1a1d2e");

    var logo_img = createImage("logo_main", "assets/img/sidebar-logo-bg.svg");
    document.body.appendChild(logo_img);
    uiStyle("logo_main", "left", "0px", "top", "0px", "77px", "77px", "");

    var btnToolMove = uiCreateButton("btn_tool_move", "sidebar-tool-move.svg", selectTool, document.body);
    uiStyle("btn_tool_move", "left", "15px", "top", "131px", "50px", "50px", "");

    var btnToolDraw = uiCreateButton("btn_tool_draw", "sidebar-tool-draw.svg", selectTool, document.body);
    uiStyle("btn_tool_draw", "left", "15px", "top", "203px", "50px", "50px", "");

    uiCreateButtonGroup("btn_tool_move", "btn_tool_draw");
    tool_selected = "btn_tool_move";

    var snap_bar = uiCreateElement("snap_bar", document.body);
    uiStyle("snap_bar", "left", "50%", "bottom", "30px", "125px", "35px", "#1a1d2e");
    snap_bar.style.borderRadius = "20px";

    var btn_snap_grid = uiCreateButton("btn_snap_grid", "snap-grid.svg", toggleSnapGrid, snap_bar);
    uiStyle("btn_snap_grid", "left", "10px", "top", "0px", "30px", "30px", "");
    var btn_snap_guides = uiCreateButton("btn_snap_guides", "snap-guides.svg", toggleSnapGuides, snap_bar);
    uiStyle("btn_snap_guides", "left", "45px", "top", "0px", "30px", "30px", "");
    var btn_snap_objects = uiCreateButton("btn_snap_objects", "snap-objects.svg", toggleSnapObjects, snap_bar);
    uiStyle("btn_snap_objects", "left", "80px", "top", "0px", "30px", "30px", "");

    var btn_guide_v = uiCreateButton("btn_guide_v", "guide-vertical.svg", null, toolbar);
    uiStyle("btn_guide_v", "left", "92px", "top", "90px", "30px", "30px", "");
    var btn_guide_h = uiCreateButton("btn_guide_h", "guide-horizontal.svg", null, toolbar);
    uiStyle("btn_guide_h", "left", "92px", "top", "125px", "30px", "30px", "");
    var btn_guide_c = uiCreateButton("btn_guide_c", "guide-clear.svg", guideClear, toolbar);
    uiStyle("btn_guide_c", "left", "92px", "top", "160px", "30px", "30px", "");

    btn_guide_v.onmousedown = function(e) {
        guideVertical();
    }
    btn_guide_h.onmousedown = function(e) {
        guideHorizontal();
    }
}

function guideVertical() {
    layers.deselectAllLayers();
    mouse_state.type = "guide_move";
    var index = render_grid.newGuide("vertical");
    //console.log(index);
    mouse_state.interaction = index;
}

function guideHorizontal() {
    layers.deselectAllLayers();
    mouse_state.type = "guide_move";
    var index = render_grid.newGuide("horizontal");
    mouse_state.interaction = index;
}

function guideClear() {

}

function toggleSnapGrid() {
    var btn = buttonFind("btn_snap_grid");
    var activated = buttonToggle(btn);
    if (activated) {
        snap_grid = true;
    } else {
        snap_grid = false;
    }
}
function toggleSnapGuides() {
    var btn = buttonFind("btn_snap_guides");
    var activated = buttonToggle(btn);
    if (activated) {
        snap_guides = true;
    } else {
        snap_guides = false;
    }
}
function toggleSnapObjects() {
    var btn = buttonFind("btn_snap_objects");
    var activated = buttonToggle(btn);
    if (activated) {
        snap_objects = true;
    } else {
        snap_objects = false;
    }
}

// Create a renderer and stuff
function createRenderer() {
    stage = new PIXI.Container();
    renderer = new PIXI.Renderer({
        backgroundAlpha: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio,
        antialias: true,
    })
    workspace.appendChild(renderer.view);
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

function spriteSheetSetup() {
    sprite_sheet = loader.resources[img_path + "spritesheet.json"].spritesheet;
    sprite_sheet_loaded = true;
    render_grid.createControlSprites();
    /*
    render_grid = new gridSystem();
    var scene = new layerScene();
    layers.addSceneLayer(scene);
    layers.selectScene(scene);
    var scene2 = new layerScene();
    layers.addSceneLayer(scene2);
    var scene3 = new layerScene();
    layers.addSceneLayer(scene3);

    update();
    */
    //console.log(sprite_sheet);
}

/*
function createGrid(project) {
    var project_area = new PIXI.Graphics();
    //project_area.beginFill(0xFFFF00);
    project_area.lineStyle(2, 0x333a4c);
    project_area.drawRect(0, 0, project.width, project.height);
    stage.addChild(project_area);
}*/

window.onload = function() {
    // Ui and stuff
    createUI();
    layers = new layerSystem();

    // Input
    input = new inputManager();
    //registerDefaultKeys();

    // Project
    project = new projectSystem();

    // Pixi workspace
    createRenderer();
    render_grid = new gridSystem();

    // Make a new scene to start with
    var scene = new layerScene();
    layers.addSceneLayer(scene);
    layers.selectScene(scene);

    // Timers
    timers = new timerSystem();

    // Main update loop
    update();
}

function update() {
    // Do stuff
    input.update();
    timers.updateTimers();
    renderer.render(stage);
    requestAnimationFrame(() => update());
}