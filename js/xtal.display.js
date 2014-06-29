/*

xtal.js Display utilities.

External dependencies: Three.js
Internal dependencies: xtal.marchingcubes.js, xtal.js, xtal.model.js

Exports:

*/
var xtal = (function(module) {return module})(xtal||{});
xtal.display = (function(module) {
	// Exports
	return {
	}
})(xtal);



//----------------------------------------------------------------------
// MAP DISPLAY
function mapDisplayObject (map, name, flag_difference_map, flag_anom_map) {
  this.data = map;
  this.name = name;
  this.display_data = null;
  this.flag_difference_map = flag_difference_map;
  this.parameters = {
    isolevel: 1.0,
    visible: true,
    color: "#00c0ff"
  };
  if (flag_difference_map) {
    if (flag_anom_map) { // anomalous residual or LLG map
      this.parameters['isolevel'] = 3.0;
      this.parameters['color'] = "#ffff00";
      this.parameters['color-'] = "#ff00ff";
    } else {
      this.parameters['isolevel'] = 3.0;
      this.parameters['color'] = "#00ff00";
      this.parameters['color-'] = "#ff0000";
    }
  } else if (flag_anom_map) {
    this.parameters['isolevel'] = 3.0;
    this.parameters['color'] = "#ffa0a0";
  }
  this.meshes = [];
  this.update_isolevel = function (isolevel, radius, center) {
    return update_map_isolevel(this, isolevel, radius, center);
  }
  this.update_mesh = function (radius, center) {
    return update_mesh(this, radius, center);
  }
  this.update_color = function (color, suffix) {
    return update_map_color(this, color, suffix);
  }
}

function isomesh (geometry, mesh_name, color)
{
  var wireframeMaterial = new THREE.MeshBasicMaterial( {
    color: 0x00c0ff, wireframe: true, transparent: true } );
  wireframeMaterial.color.setHex(color.replace("#", "0x"));
  var mesh = new THREE.Mesh( geometry, wireframeMaterial );
  mesh.name = mesh_name;
  return mesh;
}

function update_mesh (map, radius, center) {
  map.display_data = null;
  map.update_isolevel(map.parameters['isolevel'], radius, center);
}

function update_map_isolevel (map, isolevel, radius, center)
{
  if (! map.parameters['visible']) return;
  if (! map.display_data) {
    map.display_data = map.data.points_and_values(center, radius);
  }
  var levels = [1];
  var colors = [ map.parameters['color'] ];
  if (map.flag_difference_map) {
    levels = [1, -1];
    colors = [ map.parameters['color'], map.parameters['color-'] ];
  }
  for (var i = 0; i < levels.length; i++) {
    geometry = xtal.marchingcubes.isosurface(map.display_data.points,
      map.display_data.values,
      map.display_data.size,
      levels[i] * map.parameters['isolevel']);
    mesh = isomesh(geometry, "mesh_obj", colors[i]);
    map.meshes.push(mesh);
  }
}

function update_map_color (map, value, suffix) {
  if (! suffix) {
    suffix = '';
  }
  map.parameters['color' + suffix] = value;
  if (! map.parameters['visible']) return;
  if (map.flag_difference_map) {
    map.meshes[0].material.color.setHex(
      map.parameters['color'].replace("#", "0x") );
    map.meshes[1].material.color.setHex(
      map.parameters['color-'].replace("#", "0x") );
  } else {
    map.meshes[0].material.color.setHex( value.replace("#", "0x") );
  }
}

//----------------------------------------------------------------------
// MODEL

function modelDisplayObject (model, name) {
  this.model = model;
  this.name = name;
  this.parameters = {
    visible: true,
    render_style: "lines",
    color_scheme: "element",
    carbon_color: "#ffff00",
    hydrogens: (model.source == "monlib")
  };
  this.geom_objects = null; // display object (drawLines, etc.)
  this.selected = null;
  this.update_geom = function () {
    if (this.parameters["render_style"] == "lines") {
      this.geom_objects = [
        new Bonds(this.model, this.parameters["color_scheme"],
          this.parameters["carbon_color"], this.parameters["hydrogens"]) ];
    } else if (this.parameters["render_style"] == "trace") {
      this.geom_objects = [
        new Trace(this.model, this.parameters["color_scheme"],
          this.parameters["carbon_color"]) ];
    } else if (this.parameters["render_style"] == "trace+ligands") {
      this.geom_objects = [
        new Trace(this.model, this.parameters["color_scheme"],
          this.parameters["carbon_color"]),
        new Bonds(this.model, this.parameters["color_scheme"],
          this.parameters["carbon_color"], this.parameters["hydrogens"],
          true)
        // TODO spheres for ions
      ];
    }
  }
  this.show_selection = function (atom_selection) {
    this.selected = new Highlights(this.model, atom_selection);
  }
  this.select_atoms = function (atom_selection_str) {
    var atom_selection = this.model.selection(atom_selection_str);
    console.log(atom_selection.length);
    this.show_selection(atom_selection);
  }
  this.show_selection_by_atom_names = function (atom_names) {
    console.log(atom_names);
    atom_selection = this.model.select_atom_names(atom_names);
    if (atom_selection.length != 0) {
      this.show_selection(atom_selection);
    } else {
      throw Error("No atoms selected for " + atom_names);
    }
  }
  this.update_colors = function() {
    return this.update_geom();
  }
}

//*** COLORS ***
function color_by_property (values) { // generic rainbow coloring
  var vmax = Math.max.apply(null, values);
  var vmin = Math.min.apply(null, values);
  vmax -= vmin;
  if (vmax <= 0) vmax = 1;
  var colors = [];
  for (var i = 0; i < values.length; i++) {
    var ratio = (values[i] - vmin) / vmax;
    var c = new THREE.Color(0xe0e0e0);
    var hue = (240 - (240 * ratio)) / 360;
    c.setHSL(hue, 1.0, 0.5);
    colors.push(c);
  }
  return colors;
}

function color_by_bfactor (atoms, draw_hydrogens) {
  var bfactors = [];
  for (var i = 0; i < atoms.length; i++) {
    bfactors.push(atoms[i].b);
  }
  return color_by_property(bfactors);
}

function color_by_index (atoms, draw_hydrogens) {
  var indices = [];
  for (var i = 0; i < atoms.length; i++) {
    indices.push(i);
  }
  return color_by_property(indices);
}

function color_by_element (atoms, carbon_color, draw_hydrogens) {
  var colors = [];
  var element_colors = {
    "H": new THREE.Color(0xf0f0f0),
    "C": new THREE.Color(0xffff00).setHex(carbon_color.replace("#", "0x")),
    "N": new THREE.Color(0x4040ff),
    "O": new THREE.Color(0xff4040),
    "MG": new THREE.Color(0xc0c0c0),
    "P": new THREE.Color(0xffc040),
    "S": new THREE.Color(0x40ff40),
    "CL": new THREE.Color(0xa0ff60),
    "CA": new THREE.Color(0xffffff),
    "MN": new THREE.Color(0xff90c0),
    "FE": new THREE.Color(0xa03000),
    "NI": new THREE.Color(0x00ff80)
  };
  var default_color = new THREE.Color(0xa0a0a0);
  for (var i = 0; i < atoms.length; i++) {
    var color = element_colors[atoms[i].element];
    if (! color) {
      color = default_color;
    }
    colors.push(color);
  }
  return colors;
}

// BONDED REPRESENTATION
Bonds = function drawLines (model, color_style, carbon_color,
    draw_hydrogens, ligands_only) {
  var colors = [];
  var visible_atoms = [];
  if ((! draw_hydrogens) && (model.has_hydrogens)) {
    for (var i = 0; i < model.atoms.length; i++) {
      if (model.atoms[i].element != "H") {
        visible_atoms.push(model.atoms[i]);
      }
    }
  } else {
    visible_atoms = model.atoms;
  }
  if ((! color_style) || (color_style == "element") || ligands_only) {
    colors = color_by_element(visible_atoms, carbon_color, draw_hydrogens);
  } else if (color_style == "bfactor") {
    colors = color_by_bfactor(visible_atoms, draw_hydrogens);
  } else if (color_style == "rainbow") {
    colors = color_by_index(visible_atoms, draw_hydrogens);
  } else {
    console.log("Color style: " + color_style);
  }
  var ligand_flags = null;
  if (ligands_only) {
    ligand_flags = model.extract_ligands();
  }
  var k = 0;
  var geometry = new THREE.Geometry();
  for (var i = 0; i < model.atoms.length; i++) {
    var atom = model.atoms[i];
    var bonds = model.connectivity[i];
    var color = colors[k];
    if ((atom.element == "H") && (! draw_hydrogens)) {
      continue;
    }
    k++;
    if (ligands_only) {
      if (! ligand_flags[i]) continue;
    }
    if (bonds.length == 0) { // nonbonded, draw star
      draw_isolated_atom(atom, geometry, color);
    } else { // bonded, draw lines
      draw_bonded_atom(geometry, color, model, bonds, atom, draw_hydrogens,
        ligands_only, ligand_flags);
    }
  }
  var material = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    linewidth: 3
  });
  THREE.Line.call( this, geometry, material, THREE.LinePieces );
};
Bonds.prototype=Object.create(THREE.Line.prototype);

// HIGHLIGHT SELECTED ATOMS
Highlights = function drawHighlights (model, atom_selection) {
  var geometry = new THREE.Geometry();
  var color = new THREE.Color(0x80ffe0);
  for (var j = 0; j < atom_selection.length; j++) {
    var i = atom_selection[j]
    var atom = model.atoms[i];
    var bonds = model.connectivity[i];
    if (bonds.length == 0) {
      draw_isolated_atom(atom, geometry, color);
    } else {
      draw_bonded_atom(geometry, color, model, bonds, atom, true);
    }
  }
  var material = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    linewidth: 8
  });
  THREE.Line.call( this, geometry, material, THREE.LinePieces );
};
Highlights.prototype=Object.create(THREE.Line.prototype);

// C-ALPHA / PHOSPHATE BACKBONE TRACE
Trace = function drawTrace (model, color_style, carbon_color) {
  var segments = model.extract_trace();
  var colors = [];
  var visible_atoms = [];
  for (var i = 0; i < segments.length; i++) {
    for (var j = 0; j < segments[i].length; j++) {
      visible_atoms.push(segments[i][j]);
    }
  }
  if ((! color_style) || (color_style == "element")) {
    colors = color_by_element(visible_atoms, carbon_color, false);
  } else if (color_style == "bfactor") {
    colors = color_by_bfactor(visible_atoms, false);
  } else if (color_style == "rainbow") {
    colors = color_by_index(visible_atoms, false);
  } else {
    console.log("Color style: " + color_style);
  }
  var k = 0;
  var geometry = new THREE.Geometry();
  for (var i = 0; i < segments.length; i++) {
    for (var j = 0; j < segments[i].length - 1; j++) {
      var atom = segments[i][j];
      var next_atom = segments[i][j+1];
      var color = colors[k];
      k++;
      geometry.vertices.push(
        new THREE.Vector3(atom.xyz[0], atom.xyz[1], atom.xyz[2]),
        new THREE.Vector3(next_atom.xyz[0], next_atom.xyz[1],
          next_atom.xyz[2]));
      geometry.colors.push(color, color);
    }
  }
  var material = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    linewidth: 3
  });
  THREE.Line.call( this, geometry, material, THREE.LinePieces );
};
Trace.prototype=Object.create(THREE.Line.prototype);

// Draw a representation of an unbonded atom as a cross, similar to Coot and
// PyMOL
function draw_isolated_atom (atom, geometry, color) {
  var vectors = [
    [-0.5, 0, 0], [0.5, 0, 0],
    [0, -0.5, 0], [0, 0.5, 0],
    [0, 0, -0.5], [0, 0, 0.5],
  ];
  for (var j = 0; j < 6; j += 2) {
    var x1 = atom.xyz[0] + vectors[j][0];
    var y1 = atom.xyz[1] + vectors[j][1];
    var z1 = atom.xyz[2] + vectors[j][2];
    var x2 = atom.xyz[0] + vectors[j+1][0];
    var y2 = atom.xyz[1] + vectors[j+1][1];
    var z2 = atom.xyz[2] + vectors[j+1][2];
    geometry.vertices.push(
      new THREE.Vector3(atom.xyz[0], atom.xyz[1], atom.xyz[2]),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(atom.xyz[0], atom.xyz[1], atom.xyz[2]),
      new THREE.Vector3(x2, y2, z2)
    );
    geometry.colors.push(color);
    geometry.colors.push(color);
    geometry.colors.push(color);
    geometry.colors.push(color);
  }
}

// Draw bonds connecting an atom
function draw_bonded_atom (geometry, color, model, bonds, atom, draw_hydrogens,
    ligands_only, ligand_flags) {
  for (var j = 0; j < bonds.length; j++) {
    var other = model.atoms[bonds[j]];
    if ((! draw_hydrogens) && (other.element == "H")) {
      continue;
    } else if (ligands_only) {
      if (! ligand_flags[bonds[j]]) continue;
    }
    var midpoint = atom.midpoint(other);
    geometry.vertices.push(
      new THREE.Vector3(atom.xyz[0], atom.xyz[1], atom.xyz[2]),
      new THREE.Vector3(midpoint[0], midpoint[1], midpoint[2])
    );
    geometry.colors.push(color, color);
  }
}

//----------------------------------------------------------------------
// MISC DISPLAY OBJECTS

// AXES
Axis = function drawAxes (size, xyz, color_by_axis, width) {
  size = size || 1;
  width = width || 2;
  var geometry = new THREE.Geometry();
  var vectors = [
    [-1, 0, 0], [1, 0, 0],
    [0, -1, 0], [0, 1, 0],
    [0, 0, -1], [0, 0, 1],
  ];
  var x = xyz[0], y = xyz[1], z = xyz[2];
  var colors = [
    new THREE.Color( 0xff6060 ),
    new THREE.Color( 0x60ff60 ),
    new THREE.Color( 0x0060ff ),
  ];
  var default_color = new THREE.Color(0xa0ff60);
  for (var i = 0; i < 6; i += 2) {
    var x1 = x + (vectors[i][0]*size);
    var y1 = y + (vectors[i][1]*size);
    var z1 = z + (vectors[i][2]*size);
    var x2 = x + (vectors[i+1][0]*size);
    var y2 = y + (vectors[i+1][1]*size);
    var z2 = z + (vectors[i+1][2]*size);
    geometry.vertices.push(
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x1, y1, z1),
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x2, y2, z2)
    );
    if (color_by_axis) {
      geometry.colors.push(colors[i/2]);
      geometry.colors.push(colors[i/2]);
      geometry.colors.push(colors[i/2]);
      geometry.colors.push(colors[i/2]);
    } else {
      for (var j = 0; j < 4; j++) {
        geometry.colors.push(default_color);
      }
    }
  }

  var material = new THREE.LineBasicMaterial( {
    vertexColors: THREE.VertexColors,
    linewidth: width
  });
  THREE.Line.call( this, geometry, material, THREE.LinePieces );
};
Axis.prototype=Object.create(THREE.Line.prototype);

function assert_vector_is_defined (vec, var_name) {
  for (var i = 0; i < vec.length; i++) {
    if (vec[i] == NaN) {
      throw Error("undefined vector " + var_name);
    }
  }
  return true;
}

// UNIT CELL BOUNDS
function UnitCellBox (uc) {
  if (! uc) {
    throw Error("Unit cell not defined!");
  }
  var edges = [
    [0, 0, 0], [1, 0, 0],
    [0, 0, 0], [0, 1, 0],
    [0, 0, 0], [0, 0, 1],
    [1, 0, 0], [1, 1, 0],
    [1, 0, 0], [1, 0, 1],
    [0, 1, 0], [1, 1, 0],
    [0, 1, 0], [0, 1, 1],
    [0, 0, 1], [1, 0, 1],
    [0, 0, 1], [0, 1, 1],
    [1, 0, 1], [1, 1, 1],
    [1, 1, 0], [1, 1, 1],
    [0, 1, 1], [1, 1, 1]
  ];
  var geometry = new THREE.Geometry();
  for (var i = 0; i < edges.length; i += 2) {
    var xyz1 = uc.orthogonalize(edges[i]);
    var xyz2 = uc.orthogonalize(edges[i+1]);
    geometry.vertices.push(
      new THREE.Vector3(xyz1[0], xyz1[1], xyz1[2]),
      new THREE.Vector3(xyz2[0], xyz2[1], xyz2[2])
    );
  }

  geometry.colors.push(
    new THREE.Color( 0xff0000 ), new THREE.Color( 0xffaa00 ),
    new THREE.Color( 0x00ff00 ), new THREE.Color( 0xaaff00 ),
    new THREE.Color( 0x0000ff ), new THREE.Color( 0x00aaff )
  );
  for (var i = 6; i < edges.length; i++) {
    geometry.colors.push(new THREE.Color(0xffffff) );
  }
  var material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );
  THREE.Line.call( this, geometry, material, THREE.LinePieces );
};

UnitCellBox.prototype=Object.create(THREE.Line.prototype);
