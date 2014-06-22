/*

xtal.js Map & Model Viewer.

Exports:

*/
var xtal = (function(module) {return module})(xtal||{});
xtal.viewer = (function(module) {
	// Exports
	return {
	}
})(xtal);

var orthographic = false; // FIXME doesn't work properly with controls

function XtalViewer (element_id, size, draw_gui, draw_axes) {
  if (! element_id) {
    element_id = "ThreeJS";
  }
  if (! size) {
    size = [window.innerWidth, window.innerHeight];
  }
  this.maps = [];
  this.models = [];
  this.gui_folders = [];
  this.global_parameters = {
    map_radius: 10.0,
    auto_zoom: true
  };

  var controls, camera, renderer, scene, container;
  //var keyboard = new THREEx.KeyboardState();
  //var clock = new THREE.Clock();
  scene = new THREE.Scene();
  this.scene = scene;
  var SCREEN_WIDTH = size[0], SCREEN_HEIGHT = size[1];
  console.log(SCREEN_WIDTH + " " + SCREEN_HEIGHT);
  var ASPECT = SCREEN_WIDTH / SCREEN_HEIGHT;
  if (orthographic) {
    var NEAR = 5.0, FAR = 100;
    camera = new THREE.OrthographicCamera(-50, 50, -50 / ASPECT, 50 / ASPECT, NEAR, FAR);
  } else {
    var VIEW_ANGLE = 45, NEAR = 5.0, FAR = 1000;
    camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
  }
  this.camera = camera;
  scene.add(camera);
  scene.fog = new THREE.Fog(0x000000, 60, 100);
  camera.position.set(20,20,60);
  camera.lookAt(scene.position);
  if ( Detector.webgl )
    renderer = new THREE.WebGLRenderer( {antialias:true} );
  else
    renderer = new THREE.CanvasRenderer();
  this.renderer = renderer;
  renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0px";
  renderer.domElement.style.left = "0px";

  container = document.getElementById(element_id);
  container.appendChild( renderer.domElement );
  controls = new THREE.TrackballControls( camera,  renderer.domElement );
  this.controls = controls;
  controls.minDistance = 5;
  controls.maxDistance = 400;
  this.last_center = [controls.target.x, controls.target.y, controls.target.z];

  var light = new THREE.PointLight(0xffffff);
  light.position.set(0,10,0);
  scene.add(light);
  origin = new Axis(0.5, [0,0,0], true);
  scene.add(origin);

  this.create_gui = function () { return create_gui(this); };
  if (draw_gui) {
    this.create_gui();
  } else {
    this.gui = null;
  }

  // EVENTS (IMPLEMENTATIONS BELOW)
  var self = this;
  this.OnWindowResize = function (evt) {
    return OnWindowResize(self);
  }
  this.OnChange = function (evt) {
    return OnChange(self);
  }
  this.OnEnd = function (evt) {
    return OnEnd(self);
  }
  this.animate = function () {
    return animate(self);
  }

  // ADD EVENT LISTENERS
  window.addEventListener( 'resize', this.OnWindowResize, false );
  this.controls.addEventListener( 'end', this.OnEnd );
  this.controls.addEventListener( 'change', this.OnChange );

  this.update = function () {
    this.controls.update();
  }

  this.render = function () {
    this.renderer.render( this.scene, this.camera );
  }

  this.redrawAxes = function () {
    if (this.axes) {
      this.scene.remove(this.axes);
    }
    var center = this.controls.target;
    this.axes = new Axis(0.5, [ center.x, center.y,  center.z ], false );
    this.scene.add(this.axes);
  }

  this.reset = function () {
    if (this.gui) {
      this.gui.destroy();
      this.create_gui();
    }
    for (var i = 0; i < this.maps.length; i++) {
      this.maps[i].clear_mesh(true);
      delete this.maps[i];
    }
    for (var i = 0; i < this.models.length; i++) {
      this.clear_model_geom(this.models[i]);
      delete this.models[i];
    }
    this.gui_folders = [];
    this.maps = [];
    this.models = []
    this.camera.position.set(20,20,60);
    this.camera.lookAt(this.scene.position);
    this.controls.update();
    this.OnChange();
  }

  this.recenter = function (xyz) {
    this.controls.target.x = xyz[0];
    this.controls.target.y = xyz[1];
    this.controls.target.z = xyz[2];
    this.camera.lookAt(xyz);
    this.controls.update();
    this.redrawMaps();
    this.render();
  }
  
  this.zoomXYZ = function (xyz) {
    this.camera.position.x = xyz[0];
    this.camera.position.y = xyz[1];
    this.camera.position.z = xyz[2] + 20;
    this.recenter(xyz);
  }

  // MODEL AND MAP DISPLAY
  this.redrawMaps = function (force) {
    // recalculate the mesh if the center of rotation has changed
    var center = [ this.controls.target.x, this.controls.target.y,
                   this.controls.target.z ];
    if (force ||
        ((Math.abs(center[0] - this.last_center[0]) > 0.01) ||
         (Math.abs(center[1] - this.last_center[1]) > 0.01) ||
         (Math.abs(center[2] - this.last_center[2]) > 0.01))) {
      this.last_center = center;
      for (var i = 0; i < this.maps.length; i++) {
        this.maps[i].clear_mesh(true);
        this.maps[i].update_mesh(this.global_parameters['map_radius'],
          center);
        this.render_mesh(this.maps[i]);
      }
    }
  }
  
  this.clear_mesh = function (map, reset_data) {
    var i = map.meshes.length - 1;
    while (i >= 0) {
      if (map.meshes[i]) {
        this.scene.remove(map.meshes[i]);
        map.meshes.pop();
      }
      i--;
    }
    if (reset_data) {
      map.display_data = null;
    }
  }
  
  this.clear_model_geom = function (model) {
    if (model.geom_objects) {
      for (var i = 0; i < model.geom_objects.length; i++) {
        this.scene.remove(model.geom_objects[i]);
      }
    }
    model.geom_objects = null;
  }
  
  this.toggle_map_visibility = function (map, visible) {
    map.parameters['visible'] = visible;
    if (visible) {
      map.update_mesh(this.global_parameters['map_radius'], this.last_center);
      this.render_mesh(map);
    } else {
      map.clear_mesh();
    }
  }
  
  this.toggle_model_visibility = function (model, visible) {
    model.parameters['visible'] = visible;
    if (visible) {
      model.update_geom();
      this.render_model(model);
    } else {
      model.clear_geom();
    }
  }
  
  this.redraw_model = function (model) {
    model.clear_geom();
    model.update_geom();
    this.render_model(model);
  }
  
  this.render_mesh = function (map) {
    for (var i = 0; i < map.meshes.length; i++) {
      this.scene.add(map.meshes[i]);
    }
    this.render();
  }
  
  this.render_model = function (model) {
    if (model.geom_objects) {
      for (var i = 0; i < model.geom_objects.length; i++) {
        this.scene.add(model.geom_objects[i]);
      }
    }
    this.render();
  }

  this.initialize_map_object = function (mapdata, map_name, diff_map_flag,
      anom_map_flag) {
    return initialize_map_object(this, mapdata, map_name, diff_map_flag,
      anom_map_flag);
  }
  
  this.initialize_model_object = function (model, model_name) {
    return initialize_model_object(this, model, model_name);
  }

  // I/O FUNCTIONS (IMPLEMENTATIONS BELOW)
  this.fetchPDB = function (pdb_id) {
    return fetchPDB(this, pdb_id);
  }
  this.load_pdb = function (url, model_name) {
    return load_pdb(this, url, model_name);
  }
  this.load_mon_lib = function (url, model_id) {
    return load_mon_lib(this, url, model_id);
  }
  this.load_mmcif = function (url, model_name) {
    return load_mmcif(this, url, model_name);
  }
  this.load_cif = function (url, model_name) {
    return load_cif(this, url, model_name);
  }
  this.load_ccp4_map = function (url, map_name, diff_map_flag) {
    return load_ccp4_map(this, url, map_name, diff_map_flag);
  }
  this.load_dsn6_map = function (url, map_name, diff_map_flag) {
    return load_dsn6_map(this, url, map_name, diff_map_flag);
  }
  this.load_eds_maps = function (pdb_id) {
    return load_eds_maps(this, pdb_id);
  }
}

//**********************************************************************
// EVENTS
function OnWindowResize (viewer) {
  SCREEN_WIDTH = window.innerWidth;
  SCREEN_HEIGHT = window.innerHeight;
  viewer.camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
  viewer.camera.updateProjectionMatrix();
  viewer.renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
  //composer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
}

function OnChange (viewer) {
  var cx = viewer.camera.position.x,
      cy = viewer.camera.position.y,
      cz = viewer.camera.position.z;
  var ox = viewer.controls.target.x,
      oy = viewer.controls.target.y,
      oz = viewer.controls.target.z;
  var dxyz = Math.sqrt(Math.pow(cx-ox, 2) + Math.pow(cy-oy, 2) + Math.pow(cz-oz, 2));
  viewer.scene.fog.near = 2; //dxyz / 2;
  viewer.scene.fog.far = Math.min(dxyz * 1.2, dxyz+10);
  viewer.camera.near = dxyz * 0.8;
  viewer.camera.far = dxyz * 2;
  viewer.camera.updateProjectionMatrix();
  viewer.redrawAxes();
  //redrawMaps();
}

function OnEnd (viewer) {
  viewer.redrawAxes();
  viewer.redrawMaps();
}

function animate (viewer) {
  viewer.render();
  viewer.update();
  requestAnimationFrame( viewer.animate );
}

function initialize_map_object (viewer, map, map_name, diff_map_flag,
    anom_map_flag) {
  if (! diff_map_flag) {
    var diff_map_flag = ((map_name == "mFo-DFc") ||
      (map_name.indexOf("_mFo-DFc") != -1)); // XXX HACK
  }
  if (! anom_map_flag) {
    var anom_map_flag = ((map_name == "anom") ||
      (map_name.indexOf("_anom") != -1));
  }
  var map_display = new mapDisplayObject(map, map_name, diff_map_flag,
    anom_map_flag);
  map_display.clear_mesh = function () {
    viewer.clear_mesh(map_display);
  }
  if (viewer.gui) {
    setup_map_dat_gui(viewer, map_display);
  }
  viewer.maps.push(map_display);
  //var uc = new UnitCellBox(map.unit_cell);
  //scene.add(uc);
  map_display.update_mesh(viewer.global_parameters['map_radius'],
    viewer.last_center);
  viewer.render_mesh(map_display);
}

function initialize_model_object (viewer, model, model_name) {
  var model_display = new modelDisplayObject(model, model_name);
  model_display.clear_geom = function() {
    viewer.clear_model_geom(model_display);
  }
  if (viewer.gui) {
    setup_model_dat_gui(viewer, model_display);
  }
  viewer.models.push(model_display);
  viewer.redraw_model(model_display);
  if (viewer.global_parameters['auto_zoom']) {
    center_and_size = model.get_center_and_size();
    viewer.recenter(center_and_size[0]);
  }
  //feature_list = model.extract_interesting_residues();
  //loadFeatures(feature_list);
}


//**********************************************************************
// DAT GUI functions
function create_gui (viewer) {
  viewer.gui = new dat.GUI();
  var mapRadius = viewer.gui.add( viewer.global_parameters,
    'map_radius' ).min(5).max(20).step(1).name('Map radius').listen();
  mapRadius.onChange(function (value){
    viewer.redrawMaps(true);
  });
  viewer.gui.open();
}

function setup_map_dat_gui (viewer, map) {
  // GUI
  var map_gui = viewer.gui.addFolder("Map: " + map.name);
  viewer.gui_folders.push(map_gui);
  var isVisible = map_gui.add(map.parameters,
    'visible').name("Display").listen();
  isVisible.onChange(function (value){
    viewer.toggle_map_visibility(map, value);
  });
  var isoLevel = map_gui.add(map.parameters,
    'isolevel').min(0).max(8).step(0.1).name('Contour level').listen();
  isoLevel.onChange(function (value){
    map.clear_mesh();
    map.update_isolevel(value, viewer.global_parameters['map_radius'],
      viewer.last_center);
    viewer.render_mesh(map);
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

function setup_model_dat_gui (viewer, model) {
  var model_gui = viewer.gui.addFolder("Model: " +model.name);
  viewer.gui_folders.push(model_gui);
  var isVisible = model_gui.add(model.parameters,
    'visible').name("Display").listen();
  isVisible.onChange(function (value){
    viewer.toggle_model_visibility(model, value);
  });
  var repType = model_gui.add(model.parameters, "render_style",
    ["lines", "trace", "trace+ligands"]).name("Draw as").listen();
  repType.onChange(function(value) {
    viewer.redraw_model(model);
  });
  var colorType = model_gui.add(model.parameters, 'color_scheme',
    ["element", "rainbow", "bfactor"]).name("Color scheme").listen();
  colorType.onChange(function(value) {
    viewer.redraw_model(model);
  });
  var carbColor = model_gui.addColor(
    model.parameters, 'carbon_color' ).name('C atom color').listen();
  carbColor.onChange(function(value){
    if (model.color_scheme == "element") {
      viewer.redraw_model(model);
    }
  });
  model_gui.open();
}

//**********************************************************************
// I/O FUNCTIONS
//
function load_mon_lib (viewer, url, model_id) {
  var reader = new xtal.cif.Reader();
  reader.load(url, function(cif_model) {
    var comp_list = cif_model.get_block('comp_list');
    var first_block = comp_list.get('_chem_comp.id')[0];
    var first_block = cif_model.get_block('comp_' + first_block);
    var model = new xtal.model.Model();
    model.from_monlib(first_block);
    viewer.initialize_model_object(model, model_id);
  });
}

// Load mmCIF
function load_mmcif (viewer, url, model_name) {
  var reader = new xtal.cif.Reader();
  reader.load(url, function(mmcif_model) {
    var model = new xtal.model.Model();
    model.from_mmcif(mmcif_model.first_block());
    viewer.initialize_model_object(model, model_name);
  });
}

// Load small molecule CIF
function load_cif(viewer, url, model_name) {
  var reader = new xtal.cif.Reader();
  reader.load(url, function(cif_model) {
    var model = new xtal.model.Model();
    model.from_cif(cif_model.first_block());
    viewer.initialize_model_object(model, model_name);
  });
}

function load_pdb (viewer, url, model_name) {
  var req = new XMLHttpRequest();
  req.open('GET', url, true);
  req.onreadystatechange = function (aEvt) {
    if (req.readyState == 4) {
      if(req.status == 200) {
        var model = new xtal.model.Model();
        model.from_pdb(req.responseText);
        viewer.initialize_model_object(model, model_name);
      } else {
        console.log("Error fetching " + url);
      }
    }
  };
  req.send(null);
}

function load_ccp4_map (viewer, url, map_name, diff_map_flag) {
  var req = new XMLHttpRequest();
  req.responseType = "arraybuffer";
  req.open('GET', url, true);
  req.onreadystatechange = function (aEvt) {
    if (req.readyState == 4) {
      if(req.status == 200) {
        var map_data = new Int32Array(req.response);
        var map = new xtal.Map()
        map.from_ccp4(map_data);
        map.show();
        viewer.initialize_map_object(map, map_name, diff_map_flag);
      } else {
        console.log("Error fetching " + url);
      }
    }
  };
  req.send(null);
}

function load_dsn6_map (viewer, url, map_name, diff_map_flag) {
  var req = new XMLHttpRequest();
  req.responseType = "arraybuffer";
  req.open('GET', url, true);
  req.onreadystatechange = function (aEvt) {
    if (req.readyState == 4) {
      if(req.status == 200) {
        var map_data = new Uint8Array(req.response);
        var map = new xtal.Map()
        map.from_dsn6(map_data);
        console.log("DSN6 MAP:")
        map.show();
  //      console.log("###");
        viewer.initialize_map_object(map, map_name, diff_map_flag);
      } else {
        console.log("Error fetching " + url);
      }
    }
  };
  req.send(null);
}

function validate_pdb_id (pdb_id) {
  console.log("PDB ID: " + pdb_id);
  if (pdb_id.length != 4) {
    $("The string '" + pdb_id + "' is not a valid PDB ID.").dialog({
      modal: true,
      buttons: {
        Ok: function() {
          $( this ).dialog( "close" );
        }
      }
    });
    throw Error("Bad PDB ID.");
  }
}

function fetchPDB (viewer, pdb_id) {
  url = 'http://www.rcsb.org/pdb/files/' + pdb_id + ".pdb"
  load_pdb(viewer, url, pdb_id);
}

//----------------------------------------------------------------------
// ADVANCED FUNCTIONS
function requestPDB (viewer, pdb_id) {
  validate_pdb_id(pdb_id);
  var req1 = new XMLHttpRequest();
  req1.open('GET', '/' + pdb_id + '.json');
  req1.onreadystatechange = function (aEvt) {
    if (req1.readyState == 4) {
      console.log("RESPONSE");
      var response = jQuery.parseJSON(req1.responseText);
      if (response.error) {
        throw Error(response.error);
      }
      // Load PDB or mmCIF format file.
      if (response.pdb_mmcif) {
        viewer.load_mmcif(response.pdb_mmcif, pdb_id);
      } else if (response.pdb_file) {
        viewer.loadPDBFromServer(response.pdb_file, pdb_id);
      }

      if (response.features) {
        display_features_gui(response.features);
      }
      if (response.two_fofc_map) {
        loadMapFromServer(response.two_fofc_map, "2mFo-Dfc", false);
      }
      if (response.fofc_map) {
        loadMapFromServer(response.fofc_map, "mFo-Dfc", true);
      }
    }
  };
  req1.send(null);
  return;
}

// Load structure from Uppsula electron density server.  This does not actually
// work without server modifications because of JavaScript's policy against
// loading external resources.  The easiest solution is to use a reverse proxy,
// e.g. in Apache http.conf:
// ProxyPass /eds/ http://eds.bmc.uu.se/eds/
function load_eds_maps (viewer, pdb_id) {
  pdb_id = pdb_id.toLowerCase();
  validate_pdb_id(pdb_id);
  viewer.fetchPDB(pdb_id);
  subdir = pdb_id.substring(1,3);
  //base_url = "http://eds.bmc.uu.se/eds/dfs/" + subdir + "/" + pdb_id + "/";
  base_url = "/eds/dfs/" + subdir + "/" + pdb_id + "/";
  two_fofc_map = base_url + pdb_id + ".omap"
  fofc_map = base_url + pdb_id + "_diff.omap"
  viewer.load_dsn6_map(two_fofc_map, pdb_id + "_2mFo-DFc", false);
  viewer.load_dsn6_map(fofc_map, pdb_id + "_mFo-DFc", true);
}
