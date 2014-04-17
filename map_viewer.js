// MAIN

// standard global variables
var container, scene, camera, renderer, controls, origin;
//var keyboard = new THREEx.KeyboardState();
var clock = new THREE.Clock();
var maps = [];
var models = [];
var axes;
var gui;
var last_center;
var global_parameters = {
  map_radius: 10.0
};

function init()
{
  scene = new THREE.Scene();
  var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
  var VIEW_ANGLE = 45, ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT, NEAR = 5.0, FAR = 1000;
  camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
  scene.add(camera);
  scene.fog = new THREE.Fog(0x000000, 60, 100);
  camera.position.set(20,20,60);
  camera.lookAt(scene.position);
  if ( Detector.webgl )
    renderer = new THREE.WebGLRenderer( {antialias:true} );
  else
    renderer = new THREE.CanvasRenderer();
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  container = document.getElementById( 'ThreeJS' );
  container.appendChild( renderer.domElement );
  controls = new THREE.TrackballControls( camera, renderer.domElement );
  controls.minDistance = 5;
  controls.maxDistance = 400;
  controls.addEventListener( 'end', OnEnd );
  controls.addEventListener( 'change', OnChange );
  last_center = [ controls.target.x, controls.target.y, controls.target.z ];

  var light = new THREE.PointLight(0xffffff);
  light.position.set(0,10,0);
  scene.add(light);
  origin = new Axis(0.5, [0,0,0], true);
  scene.add(origin);
  redrawAxes();

  gui = new dat.GUI();
  var mapRadius = gui.add( global_parameters, 'map_radius' ).min(5).max(20).step(1).name('Map radius').listen();
  mapRadius.onChange(function (value)
  {   redrawMaps(true); });
  gui.open();

}

function animate()
{
  requestAnimationFrame( animate );
  render();
  update();
}

function update()
{
  controls.update();
}

function render()
{
  renderer.render( scene, camera );
}

function readCCP4Map(evt) {
  var file = evt.target.files[0];
  if (file) {
    console.log("Reading file " + file.name);
    var fr = new FileReader();
    var fn = file.name;
    fr.onloadend = function() {
      var contents = this.result;
      console.log("read " + contents.length + " bytes");
      var mapdata = new Int32Array(contents);
      initialize_map_object(mapdata, fn);
    };
    fr.readAsArrayBuffer(file);
  } else {
    console.log("No file!");
  }
}

function initialize_map_object (mapdata, map_name) {
  var map = new ccp4_map(mapdata);
  var diffmap = map_name.indexOf("_mFo-DFc") != -1; // XXX HACK
  var map_display = new mapDisplayObject(map, map_name, diffmap);
  map_display.clear_mesh = function () {
    clear_mesh(map_display);
  }
  setup_map_dat_gui(map_display);
  maps.push(map_display);
  //var uc = new UnitCellBox(map.unit_cell);
  //scene.add(uc);
  map_display.update_mesh(global_parameters['map_radius']);
  render_mesh(map_display);
}

function initialize_model_object (model, model_name) {
  var model_display = new modelDisplayObject(model, model_name);
  model_display.clear_geom = function() {
    clear_model_geom(model_display);
  }
  setup_model_dat_gui(model_display);
  models.push(model_display);
  redraw_model(model_display);
}

function readPDBfile (evt) {
  var file = evt.target.files[0];
  if (file) {
    console.log("Reading file " + file.name);
    var fr = new FileReader();
    fr.onloadend = function() {
      var contents = this.result;
      var model = new Model(contents);
      initialize_model_object(model, file.name);
    };
    fr.readAsText(file);
  } else {
    console.log("No file!");
  }
}

// EVENTS
function OnChange () {
  var cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  var ox = controls.target.x, oy = controls.target.y, oz = controls.target.z;
  var dxyz = Math.sqrt(Math.pow(cx-ox, 2) + Math.pow(cy-oy, 2) + Math.pow(cz-oz, 2));
  scene.fog.near = dxyz - 1;
  scene.fog.far = Math.max(dxyz * 1.2, dxyz+10);
  camera.near = dxyz * 0.8;
  camera.far = dxyz * 2;
  camera.updateProjectionMatrix();
  redrawAxes();
  //redrawMaps();
}

function OnEnd () {
  redrawAxes();
  redrawMaps();
}

function redrawAxes () {
  if (axes) {
    scene.remove(axes);
  }
  var center = controls.target;
  axes = new Axis(0.5, [ center.x, center.y,  center.z ], false );
  scene.add(axes);
}

function redrawMaps (force) {
  // recalculate the mesh if the center of rotation has changed
  var center = [ controls.target.x, controls.target.y, controls.target.z ];
  if (force ||
      ((center[0] != last_center[0]) ||
       (center[1] != last_center[1]) ||
       (center[2] != last_center[2]))) {
    last_center = center;
    for (var i = 0; i < maps.length; i++) {
      maps[i].clear_mesh(true);
      maps[i].update_mesh(global_parameters['map_radius']);
      render_mesh(maps[i]);
    }
  }
}

function setup_map_dat_gui (map) {
  // GUI
  var map_gui = gui.addFolder("Map: " + map.name);
  var isVisible = map_gui.add(map.parameters,
    'visible').name("Display").listen();
  isVisible.onChange(function (value){
    toggle_map_visibility(map, value);
  });
  var isoLevel = map_gui.add(map.parameters,
    'isolevel').min(0).max(8).step(0.1).name('Contour level').listen();
  isoLevel.onChange(function (value){
    map.clear_mesh();
    map.update_isolevel(value, global_parameters['map_radius']);
    render_mesh(map);
  });
  if (map.flag_difference_map) {
    var mapColorPos = map_gui.addColor(
      map.parameters, 'color' ).name('Color (+)').listen();
    mapColorPos.onChange(function(value){
      map.update_color(value, "");
    });
    var mapColorNeg = map_gui.addColor(
      map.parameters, 'color-' ).name('Color (-)').listen();
    mapColorNeg.onChange(function(value){
      map.update_color(value, "-");
    });
  } else {
    var mapColor = map_gui.addColor(
      map.parameters, 'color' ).name('Color').listen();
    mapColor.onChange(function(value){
      map.update_color(value, '');
    });
  }
  map_gui.open();
}

function setup_model_dat_gui (model) {
  var model_gui = gui.addFolder("Model: " +model.name);
  var isVisible = model_gui.add(model.parameters,
    'visible').name("Display").listen();
  isVisible.onChange(function (value){
    toggle_model_visibility(model, value);
  });
  console.log(model.parameters['color_scheme']);
  var colorType = model_gui.add(model.parameters, 'color_scheme',
    ["element", "rainbow", "bfactor"]).name("Color scheme").listen();
  colorType.onChange(function(value) {
    redraw_model(model);
  });
  var carbColor = model_gui.addColor(
    model.parameters, 'carbon_color' ).name('C atom color').listen();
  carbColor.onChange(function(value){
    if (model.color_scheme == "element") {
      redraw_model(model);
    }
  });
  model_gui.open();
}

function clear_mesh (map, reset_data) {
  var i = map.meshes.length - 1;
  while (i >= 0) {
    if (map.meshes[i]) {
      scene.remove(map.meshes[i]);
      map.meshes.pop();
    }
    i--;
  }
  if (reset_data) {
    map.display_data = null;
  }
}

function clear_model_geom (model) {
  scene.remove(model.geom);
  model.geom = null;
}

function toggle_map_visibility (map, visible) {
  map.parameters['visible'] = visible;
  if (visible) {
    map.update_mesh(global_parameters['map_radius']);
    render_mesh(map);
  } else {
    map.clear_mesh();
  }
}

function toggle_model_visibility (model, visible) {
  model.parameters['visible'] = visible;
  if (visible) {
    model.update_geom();
    render_model(model);
  } else {
    model.clear_geom();
  }
}

function redraw_model (model) {
  model.clear_geom();
  model.update_geom();
  render_model(model);
}

function render_mesh (map) {
  for (var i = 0; i < map.meshes.length; i++) {
    scene.add(map.meshes[i]);
  }
  render();
}

function render_model (model) {
  if (model.geom) {
    scene.add(model.geom);
  }
  render();
}
