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
  this.parameters = {
    visible: true,
    render_style: "lines",
    color_scheme: "element",
    carbon_color: "#ffff00",
    hydrogens: (model.source == "monlib")
  };
  this.model = model;
  this.name = name;
  this.geom_objects = null; // display object (drawLines, etc.)
  this.selected = null;
  this._ribbon = null;
  this.update_geom = function () {
    if (this.parameters["render_style"] == "lines") {
      this.geom_objects = [ new Bonds(this.model, this.parameters), ];
    } else if (this.parameters["render_style"] == "trace") {
      this.geom_objects = [ new Trace(this.model, this.parameters) ];
    } else if (this.parameters["render_style"] == "trace+ligands") {
      this.geom_objects = [
        new Trace(this.model, this.parameters),
        new Bonds(this.model, this.parameters)
        // TODO spheres for ions
      ];
    } else if (this.parameters["render_style"] == "ribbon") {
      if (this._ribbon == null) {
        this._ribbon = new RibbonGeometry(this.model);
      }
      this.geom_objects = [
        new Ribbon(this.model, this._ribbon),
        new Bonds(this.model, this.parameters, true)
      ];
    } else if (this.parameters["render_style"] == "ellipsoids") {
      anisous = new Ellipsoids(this.model, this.parameters)
      this.geom_objects = [
        new Bonds(this.model, this.parameters), anisous
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
Bonds = function drawLines (model, params, ligands_only) {
  var color_style = params.color_scheme;
  var draw_hydrogens = params.hydrogens;
  if (ligands_only == null) {
    ligands_only = params.render_style == "trace+ligands";
  }
  var carbon_color = params.carbon_color;
  var draw_nonbonded = params.render_style != "ellipsoids";
  var colors = [];
  var visible_atoms = [];
  var atoms = model.atoms();
  if ((! draw_hydrogens) && (model.has_hydrogens)) {
    for (var i = 0; i < atoms.length; i++) {
      if (atoms[i].element != "H") {
        visible_atoms.push(atoms[i]);
      }
    }
  } else {
    visible_atoms = atoms;
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
  for (var i = 0; i < atoms.length; i++) {
    var atom = atoms[i];
    var bonds = model.connectivity[i];
    var color = colors[k];
    if ((atom.element == "H") && (! draw_hydrogens)) {
      continue;
    }
    k++;
    if (ligands_only) {
      if (! ligand_flags[i]) continue;
    }
    if ((bonds.length == 0) && (draw_nonbonded)) { // nonbonded, draw star
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
    var atom = model.atoms()[i];
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
Trace = function drawTrace (model, params) {
  var color_style = params.color_scheme;
  var carbon_color = params.carbon_color;
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
  var atoms = model.atoms();
  for (var j = 0; j < bonds.length; j++) {
    var other = atoms[bonds[j]];
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
// RIBBON
Ribbon = function drawRibbon (model, ribbon_geom) {
  var colors = color_by_index(model.atoms());
  var geometry = new THREE.Geometry();
  ribbon_geom.draw_ribbon(geometry, colors);
  var material = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    linewidth: 1
  });
  THREE.Line.call( this, geometry, material, THREE.LinePieces );
};
Ribbon.prototype=Object.create(THREE.Line.prototype);

function RibbonGeometry (model) {
  this.c_alpha_i_seqs = [];
  this.o_i_seqs = [];
  this.c_i_seqs = [];
  this._segments = [];
  var chains = model.chains();
  var n_c_alpha = 0;
  console.log("CHAINS:", chains.length);
  for (var i_chain = 0; i_chain < chains.length; i_chain++) {
    var last_c_alpha = null;
    var residues = chains[i_chain].residues();
    var current_segment = null;
    console.log("RESIDUES:", residues.length);
    for (var i_res = 0; i_res < residues.length; i_res++) {
      var residue = residues[i_res];
      if (residue.n_atoms() < 3) {
        last_c_alpha = null;
        continue;
      }
      var c_alpha = residue.get_atom("CA");
      var c_atom = residue.get_atom("C");
      var o_atom = residue.get_atom("O");
      if ((c_alpha == null) || (c_atom == null) || (o_atom == null)) {
        last_c_alpha = null;
        continue;
      }
      n_c_alpha++;
      if (last_c_alpha != null) {
        if (c_alpha.distance(last_c_alpha) > 5.5) {
          last_c_alpha = null;
          current_segment = null;
        }
      }
      if (current_segment == null) {
        current_segment = new RibbonSegment(c_alpha, last_c_alpha, c_atom,
          o_atom);
        this._segments.push(current_segment);
      } else {
        current_segment.add_residue(c_alpha, c_atom, o_atom);
      }
      last_c_alpha = c_alpha;
    }
  }
  console.log("SEGMENTS:", this._segments.length);
  this.draw_ribbon = function (geometry, colors) {
    for (var i = 0; i < this._segments.length; i++) {
      var segment = this._segments[i];
      segment.draw_ribbon(geometry, colors);
    }
  }
}

function RibbonSegment (c_alpha, last_c_alpha, c_atom, o_atom, ribbon_width) {
  if (! ribbon_width) {
    ribbon_width = 1.0;
  }
  this._last_site = null
  this._anchors = [ c_alpha.as_vec3() ];
  this._indices = [ c_alpha.i_seq ];
  this._peptide_vectors = [ o_atom.as_vec3().sub(c_atom.as_vec3()) ];
  this._vertices = null;
  this._vertex_i_seqs = [];
  this._ribbon_vertex_vectors = null;
  if (last_c_alpha != null) {
    this._last_site = last_c_alpha.as_vec3();
  }
  this.add_residue = function (c_alpha, c_atom, o_atom) {
    this._anchors.push(c_alpha.as_vec3());
    this._indices.push(c_alpha.i_seq);
    this._peptide_vectors.push(o_atom.as_vec3().sub(c_atom.as_vec3()));
  }
  this.construct_geometry = function (smoothness) {
    var n_sites = this._anchors.length;
    if (! smoothness) {
      smoothness = 5;
    }
    if (this._last_site != null) {
      this._anchors.splice(0, 0, this._last_site);
      this._indices.splice(0, 0, this._indices[0]);
    } else {
      v01 = this._anchors[0].clone().sub(this._anchors[1]);
      v00 = this._anchors[0].clone().add(v01);
      this._anchors.splice(0, 0, v00);
      this._indices.splice(0, 0, this._indices[0]);
    }
    var anchors = this._anchors;
    var indices = this._indices;
    // TODO next site
    var t = smoothness;
    var vertices_ = [];
    var vertex_i_seqs_ = [];
    var ribbon_vectors = [];
    for (var k = -4; k <= 4; k++) {
      var offset = (ribbon_width / 2) * k / 4.0;
      var vertex_i_seqs = [];
      var vertices = [];
      var prev_vec = this._peptide_vectors[0].clone();
      var prev_vec_inverted = false;
      for (var i = 1; i < n_sites-1; i++) {
        var pep_vec = this._peptide_vectors[i].clone();
        var next_vec = this._peptide_vectors[i+1].clone();
        var angle1 = pep_vec.angleTo(prev_vec) * 180 / Math.PI;
        if (angle1 > 90) {
          pep_vec.multiplyScalar(-1.0);
        }
        var pep1 = pep_vec.clone().add(prev_vec).normalize();
        var angle2 = pep_vec.angleTo(next_vec) * 180 / Math.PI;
        if (angle2 > 90) {
          next_vec.multiplyScalar(-1.0);
        }
        var pep2 = pep_vec.clone().add(next_vec).normalize();
        prev_vec = pep_vec; // this._peptide_vectors[i].clone();
        var pep_vec_offset1 = pep1.multiplyScalar(offset);
        var pep_vec_offset2 = pep2.multiplyScalar(offset);
        var v0 = anchors[i-1].clone().add(pep_vec_offset1);
        var v1 = anchors[i].clone().add(pep_vec_offset1);
        var v2 = anchors[i+1].clone().add(pep_vec_offset2);
        var v3 = anchors[i+2].clone().add(pep_vec_offset2);
        /*if (! prev_vec_inverted) {
          
        }*/
        var v10 = v1.clone().sub(v0).normalize();
        var v23 = v2.clone().sub(v3).normalize();
        var v05 = v0.clone().add(v1).multiplyScalar(0.5);
        var _v15 = v1.clone().add(v2).multiplyScalar(0.5);
        var v25 = v2.clone().add(v3).multiplyScalar(0.5);
        var v15 = _v15.add(v10.clone().add(v23).multiplyScalar(0.5));
        if (i == 1) {
          vertices.push(v05);
          ribbon_vectors.push(pep_vec);
          vertex_i_seqs.push(indices[0]);
          var new_vertices_0 = interpolate(v0,v05,v1,v15,t);
          //vertices.push.apply(vertices, new_vertices_0);
          for (var j = 0; j < new_vertices_0.length; j++) {
            vertices.push(new_vertices_0[j]);
            ribbon_vectors.push(pep_vec);
            vertex_i_seqs.push(indices[i]);
          }
        }
        vertices.push(v1);
        ribbon_vectors.push(pep_vec);
        vertex_i_seqs.push(indices[i]);
        var new_vertices_1 = interpolate(v05,v1,v15,v2,t);
        //vertices.push.apply(vertices, new_vertices_1);
        for (var j = 0; j < new_vertices_1.length; j++) {
          vertices.push(new_vertices_1[j]);
          vertex_i_seqs.push(indices[i]);
          ribbon_vectors.push(pep_vec);
        }
        vertices.push(v15);
        ribbon_vectors.push(pep_vec);
        vertex_i_seqs.push(indices[i]);
        var new_vertices_2 = interpolate(v1,v15,v2,v25,t);
        //vertices.push.apply(vertices, new_vertices_2);
        for (var j = 0; j < new_vertices_2.length; j++) {
          vertices.push(new_vertices_2[j]);
          vertex_i_seqs.push(indices[i+1]);
          ribbon_vectors.push(pep_vec);
        }
        if (i == (n_sites - 1)) {
          var new_vertices_3 = interpolate(v15, v2,v25,v3,t);
          //vertices.push.apply(vertices, new_vertices_3);
          for (var j = 0; j < new_vertices_3.length; j++) {
            vertices.push(new_vertices_3[j]);
            vertex_i_seqs.push(indices[n_sites]);
            ribbon_vectors.push(pep_vec);
          }
        }
      }
      if (vertices.length != vertex_i_seqs.length) {
        throw Error("Array size mismatch:",vertices.length,
          vertex_i_seqs.length);
      }
      vertices_.push(vertices);
      vertex_i_seqs_.push(vertex_i_seqs);
    }
    this._vertices = vertices_;
    this._vertex_i_seqs = vertex_i_seqs_;
    this._ribbon_vertex_vectors = ribbon_vectors;
  }
  this.draw_ribbon = function (geometry, colors) {
    if (this._vertices == null) {
      this.construct_geometry(8);
    }
    for (var k = 0; k < 9; k++) {
      vertices = this._vertices[k];
      indices = this._vertex_i_seqs[k];
      for (var i = 1; i < vertices.length; i++) {
        var j = indices[i];
        geometry.vertices.push(vertices[i-1], vertices[i]);
        geometry.colors.push(colors[j], colors[j]);
      }
    }
  }
}

//----------------------------------------------------------------------
// ADP ellipsoids
// FIXME is it possible to make the insides darker?  right now the effect of
// clipping an ellipsoid is somewhat confusing
Ellipsoids = function drawEllipsoids (model, params) {
  var color_style = params.color_scheme;
  var carbon_color = params.carbon_color;
  var draw_hydrogens = params.hydrogens;
  var solid_material = true;
  var colors = [];
  var visible_atoms = [];
  var atoms = model.atoms();
  if ((! draw_hydrogens) && (model.has_hydrogens)) {
    for (var i = 0; i < atoms.length; i++) {
      if (atoms[i].element != "H") {
        visible_atoms.push(atoms[i]);
      }
    }
  } else {
    visible_atoms = atoms;
  }
  if ((! color_style) || (color_style == "element")) {
    colors = color_by_element(visible_atoms, carbon_color, draw_hydrogens);
  } else if (color_style == "bfactor") {
    colors = color_by_bfactor(visible_atoms, draw_hydrogens);
  } else if (color_style == "rainbow") {
    colors = color_by_index(visible_atoms, draw_hydrogens);
  } else {
    console.log("Color style: " + color_style);
  }
  var geometry = new THREE.Geometry();
  var material;
  var material_inside;
  if (solid_material) {
    material = new THREE.MeshPhongMaterial( {
      vertexColors: true});//, wireframe: true } );
    material.side = THREE.DoubleSide;
    /*material_inside = new THREE.MeshPhongMaterial( {
      vertexColors: true, ambient: 0x000000, specular: 0x101010 });*/
  } else {
    material = new THREE.MeshBasicMaterial( {
      vertexColors: true, wireframe: true } );
  }
  var sphere_geometry = new THREE.SphereGeometry( 1, 10, 8 );
  for (var i = 0; i < visible_atoms.length; i++) {
    var atom = visible_atoms[i];
    if (atom.uij == null) continue;
    var color = colors[i];
    var m = atom.ellipsoid_to_sphere_transform();
    // I think the input transform (m) is column-major - we need row-major
    var transform = new THREE.Matrix4(
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15]
    );
    for (var j = 0; j < sphere_geometry.faces.length; j++) {
      sphere_geometry.faces[j].color = color;
      /*if (sphere_geometry.faces[j].normal.z == 1) {
        sphere_geometry.faces[j].materialIndex = 1;
      }*/
    }
    geometry.merge(sphere_geometry, transform, i);
  }
  var combined_material;
  if (false) { //solid_material) {
    var materials = [ material, material_inside ];
    combined_material = new THREE.MeshFaceMaterial(materials);
  } else {
    combined_material = material;
  }
  var mesh = new THREE.Mesh(geometry, combined_material);
  THREE.Mesh.call(this, geometry, material);
};
Ellipsoids.prototype=Object.create(THREE.Mesh.prototype);

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

function vec3 (x,y,z) {
  return new THREE.Vector3(x,y,z);
}

function interpolate (p0, p1, p2, p3, n_points) {
  var spline = new THREE.Spline([p0,p1,p2,p3]);
  var points = [];
  for (var i = 1; i <= n_points; i++) {
    var k = (1.0 + i/n_points) / 3.0;
    var pt = spline.getPoint(k);
    points.push(new THREE.Vector3(pt.x, pt.y, pt.z));
  }
  return points;
}
