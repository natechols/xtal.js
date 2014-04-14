
//----------------------------------------------------------------------
// MAP DISPLAY
function mapDisplayObject (map, name, flag_difference_map) {
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
    this.parameters['isolevel'] = 3.0;
    this.parameters['color'] = "#00ff00";
    this.parameters['color-'] = "#ff0000";
  }
  this.meshes = [];
  this.update_isolevel = function (isolevel, radius) {
    return update_map_isolevel(this, isolevel, radius);
  }
  this.update_mesh = function (radius) {
    return update_mesh(this, radius);
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

function update_mesh (map, radius) {
  map.display_data = null;
  map.update_isolevel(map.parameters['isolevel'], radius);
}

function update_map_isolevel (map, isolevel, radius)
{
  if (! map.parameters['visible']) return;
  if (! map.display_data) {
    map.display_data = map.data.points_and_values(last_center, radius);
  }
  var levels = [1];
  var colors = [ map.parameters['color'] ];
  if (map.flag_difference_map) {
    levels = [1, -1];
    colors = [ map.parameters['color'], map.parameters['color-'] ];
  }
  for (var i = 0; i < levels.length; i++) {
    geometry = isosurface(map.display_data.points,
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

Bonds = function drawLines (model) {
  var colors = {
    "C": new THREE.Color(0xffff00),
    "H": new THREE.Color(0xf0f0f0),
    "N": new THREE.Color(0x4040ff),
    "O": new THREE.Color(0xff4040),
    "S": new THREE.Color(0x40ff40),
    "P": new THREE.Color(0xffc040)
  };
  var default_color = new THREE.Color(0xa0a0a0);
  var geometry = new THREE.Geometry();
  for (var i = 0; i < model.atoms.length; i++) {
    var atom = model.atoms[i];
    var bonds = model.connectivity[i];
    var color = colors[atom.element];
    if (! color) {
      color = default_color;
    }
    if (bonds.length == 0) { // nonbonded, draw star
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
    } else { // bonded, draw lines
      for (var j = 0; j < bonds.length; j++) {
        var other = model.atoms[bonds[j]];
        var midpoint = atom.midpoint(other);
        geometry.vertices.push(
          new THREE.Vector3(atom.xyz[0], atom.xyz[1], atom.xyz[2]),
          new THREE.Vector3(midpoint[0], midpoint[1], midpoint[2])
        );
        geometry.colors.push(color, color);
      }
    }
  }
  var material = new THREE.LineBasicMaterial({
    vertexColors: THREE.VertexColors,
    linewidth: 3
  });
  THREE.Line.call( this, geometry, material, THREE.LinePieces );
};
Bonds.prototype=Object.create(THREE.Line.prototype);

//----------------------------------------------------------------------
// MISC DISPLAY OBJECTS

// AXES
Axis = function drawAxes (size) {
  size = size || 1;
  var geometry = new THREE.Geometry();
  var center = controls.target;
  var vectors = [
    [-1, 0, 0], [1, 0, 0],
    [0, -1, 0], [0, 1, 0],
    [0, 0, -1], [0, 0, 1],
  ];
  var x = center.x, y = center.y, z = center.z;
  var colors = [
    new THREE.Color( 0xff6060 ),
    new THREE.Color( 0x60ff60 ),
    new THREE.Color( 0x0060ff ),
  ];
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
    geometry.colors.push(colors[i/2]);
    geometry.colors.push(colors[i/2]);
    geometry.colors.push(colors[i/2]);
    geometry.colors.push(colors[i/2]);
  }

  var material = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );
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
