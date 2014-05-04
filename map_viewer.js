// MAIN

// standard global variables
var orthographic = false;
var container, scene, camera, renderer, controls, origin;
//var keyboard = new THREEx.KeyboardState();
var clock = new THREE.Clock();
var maps = [];
var models = [];
var axes;
var gui;
var last_center;
var global_parameters = {
  map_radius: 10.0,
  auto_zoom: true
};

function init_3d() {
  scene = new THREE.Scene();
  var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight;
  var ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT;
  if (orthographic) {
    var NEAR = 5.0, FAR = 100;
    camera = new THREE.OrthographicCamera(-50, 50, -50 / ASPECT, 50 / ASPECT, NEAR, FAR);
  } else {
    var VIEW_ANGLE = 45, NEAR = 5.0, FAR = 1000;
    camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
  }
  scene.add(camera);
  scene.fog = new THREE.Fog(0x000000, 60, 100);
  camera.position.set(20,20,60);
  camera.lookAt(scene.position);
  if ( Detector.webgl )
    renderer = new THREE.WebGLRenderer( {antialias:true} );
  else
    renderer = new THREE.CanvasRenderer();
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0px";
  renderer.domElement.style.left = "0px";

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
  var mapRadius = gui.add( global_parameters,
    'map_radius' ).min(5).max(20).step(1).name('Map radius').listen();
  mapRadius.onChange(function (value){
    redrawMaps(true);
  });
  gui.open();

  window.addEventListener( 'resize', onWindowResize, false );
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
  if (global_parameters['auto_zoom']) {
    center_and_size = model.get_center_and_size();
    recenter(center_and_size[0]);
  }
  //feature_list = model.extract_interesting_residues();
  //loadFeatures(feature_list);
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
  var repType = model_gui.add(model.parameters, "render_style",
    ["lines", "trace", "trace+ligands"]).name("Draw as").listen();
  repType.onChange(function(value) {
    redraw_model(model);
  });
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
  if (model.geom_objects) {
    for (var i = 0; i < model.geom_objects.length; i++) {
      scene.remove(model.geom_objects[i]);
    }
  }
  model.geom_objects = null;
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
  if (model.geom_objects) {
    for (var i = 0; i < model.geom_objects.length; i++) {
      scene.add(model.geom_objects[i]);
    }
  }
  render();
}

// EVENTS
function onWindowResize( event ) {
  SCREEN_WIDTH = window.innerWidth;
  SCREEN_HEIGHT = window.innerHeight;
  camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
  camera.updateProjectionMatrix();
  renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
  //composer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
}

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

//----------------------------------------------------------------------
// JQUERY GUI STUFF

// http://www.fam.tuwien.ac.at/~schamane/_/blog:110802_vertical_sliding_panel_with_auto-hide
function expandPanel() {
//  $('#loadControlsHandle').toggle(false);
  $('#loadControls').slideDown('fast');
  /* hide the panel also on any click */
  $('#loadControlsHandle').click(collapsePanel);
};

function collapsePanel() {
//  $('#loadControlsHandle').toggle(true);
  $('#loadControls').slideUp('fast');
  $('#loadControlsHandle').unbind('click');
};

function expandFeatures() {
  //$("#featureHeader").toggle(false);
  $("#featureList").slideDown('fast');
  $('#featureHandle').click(collapseFeatures);
};

function collapseFeatures() {
  //$("#featureHeader").toggle(true);
  $("#featureList").slideUp('fast');
};

function init_gui () {
  $(function(){
      var width = $("#controlBox").width();
      $("#loadControlsMargin").width(width);
      //$("#loadControls").width(width);
  });
  
  $(document).ready(function() {
    /* expandPanel on click, too - good for mobile devices without mouse */
    $('#loadControlsHandle').click(expandPanel);
    /* show panel on mouse hover */
    $('#loadControlsHandle').hoverIntent({
      over: expandPanel,
      timeout: 10,
      out: function() {return true;}
    });
    /* hide panel when leaving panel */
    $('#loadControls').hoverIntent({
      over: function() {return true;},
      timeout: 10,
      out: collapsePanel
    });
    $('#featureHandle').click(expandFeatures);
    $('#featureHandle').hoverIntent({
      over: expandFeatures,
      timeout: 10,
      out: function() {return true;}
    });
    $('#featureList').hoverIntent({
      over: function() { return true;},
      timeout: 10,
      out: collapseFeatures
    });
  });
}

function loadFeatures (features) {
  $("#featureList").empty();
  console.log("Adding " + features.length + " features");
  for (var i = 0; i < features.length; i++) {
    var inner = $("<div/>", {
      id:"feature"+i,
      class:"featureItem"}).text(features[i][0]);
    var outer = $("<div/>", {
        id:"featuresMargin",
        class:"controlMargin" }).text('');
    outer.append(inner);
    outer.appendTo("#featureList");
    inner.data("Data",{
        label: features[i][0],
        xyz: features[i][1]
      });
    inner.click(zoomXYZ);
  }
  //$("featureList").html();
  expandFeatures();
}

function recenter (xyz) {
  controls.target.x = xyz[0];
  controls.target.y = xyz[1];
  controls.target.z = xyz[2];
  camera.lookAt(xyz);
  controls.update();
  OnChange();
}

function zoomXYZ (evt) {
  var data = $(this).data("Data");
  camera.position.x = data.xyz[0];
  camera.position.y = data.xyz[1];
  camera.position.z = data.xyz[2] + 20;
  recenter(data.xyz);
}

function loadFromPDB (evt) {
  var pdb_id = $("#pdbIdInput").val();
  console.log("HELLO");
  console.log(pdb_id);
  if (pdb_id.length != 4) {
    $("The string '" + pdb_id + "' is not a valid PDB ID.").dialog({
      modal: true,
      buttons: {
        Ok: function() {
          $( this ).dialog( "close" );
        }
      }
    });
  }
  var req = new XMLHttpRequest();
  req.open('GET', 'http://www.rcsb.org/pdb/files/' + pdb_id + ".pdb", true);
  req.onreadystatechange = function (aEvt) {
    if (req.readyState == 4) {
      if(req.status == 200) {
        var model = new Model(req.responseText);
        initialize_model_object(model, pdb_id);
      } else {
        console.log("Error fetching " + pdb_id);
      }
    }
  };
  req.send(null);
}

function requestFromServer (evt) {
  var pdb_id = $("#pdbIdInput").val();
  console.log("HELLO");
  console.log(pdb_id);
  if (pdb_id.length != 4) {
    $("The string '" + pdb_id + "' is not a valid PDB ID.").dialog({
      modal: true,
      buttons: {
        Ok: function() {
          $( this ).dialog( "close" );
        }
      }
    });
  }
  var req1 = new XMLHttpRequest();
  req1.open('GET', 'http://localhost:8080/' + pdb_id, true);
  req1.onreadystatechange = function (aEvt) {
    if (req1.readyState == 4) {
      var response = jQuery.parseJSON(req1.responseText);
      if (response.error) {
        throw Error(response.error);
      }
      loadPDBFromServer(response.pdb_file, pdb_id);
    } else {
      console.log(req1.readyState);
    }
  };
  req1.send(null);
  return;
}

function loadPDBFromServer (pdb_file, model_name) {
  var req = new XMLHttpRequest();
  console.log(pdb_file);
  req.open('GET', 'http://localhost:8080' + pdb_file, true);
  req.onreadystatechange = function (aEvt) {
    if (req.readyState == 4) {
      if(req.status == 200) {
        var model = new Model(req.responseText);
        initialize_model_object(model, model_name);
      } else {
        console.log("Error fetching " + pdb_file);
      }
    }
  };
  req.send(null);
}
