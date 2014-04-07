
//----------------------------------------------------------------------
// UNIT CELL
// Derived from cctbx.uctbx (C++ code)
//
function UnitCell (a, b, c, alpha, beta, gamma) {
  this.a = a;
  this.b = b;
  this.c = c;
  this.alpha = alpha;
  this.beta = beta;
  this.gamma = gamma;
  this.params = [a, b, c, alpha, beta, gamma];
  if (a <= 0 || b <= 0 || c <= 0 || alpha <= 0 || beta <= 0 || gamma <= 0) {
    throw Error("Zero or negative unit cell parameter(s).");
  }
  this.cos_ang = [
    Math.cos(deg2rad(alpha)),
    Math.cos(deg2rad(beta)),
    Math.cos(deg2rad(gamma))
  ];
  this.sin_ang = [
    Math.sin(deg2rad(alpha)),
    Math.sin(deg2rad(beta)),
    Math.sin(deg2rad(gamma))
  ];
  this.r_cos_ang = [];
  for (var i = 0; i < 3; i++) {
    denom = this.sin_ang[(i+1)%3] * this.sin_ang[(i+2)%3];
    if (denom == 0) {
      throw Error("Zero denominator");
    }
    this.r_cos_ang.push((this.cos_ang[(i+1)%3] *
                         this.cos_ang[(i+2)%3] -
                         this.cos_ang[i]) / denom);
  }
  var s1rca2 = Math.sqrt(1. - this.r_cos_ang[0]*this.r_cos_ang[0]);
  this.orth = [
    this.params[0],
    this.cos_ang[2] * this.params[1],
    this.cos_ang[1] * this.params[2],
    0.,
    this.sin_ang[2] * this.params[1],
    -this.sin_ang[1] * this.r_cos_ang[0] * this.params[2],
    0.0,
    0.0,
    this.sin_ang[1] * this.params[2] * s1rca2
  ];
  this.frac = [
    1.0 / this.a,
    -this.cos_ang[2] / (this.sin_ang[2] * this.params[0]),
    -(this.cos_ang[2] * this.sin_ang[1] * this.r_cos_ang[0] +
      this.cos_ang[1] * this.sin_ang[2]) /
     (this.sin_ang[2] * s1rca2 * this.sin_ang[2] * this.params[0]),
    0.0,
    1.0 / (this.sin_ang[2] * this.params[1]),
    this.r_cos_ang[0] / (s1rca2 * this.sin_ang[2] * this.params[1]),
    0.0,
    0.0,
    1.0 / (this.sin_ang[1] * s1rca2 * this.params[2])
  ];
  // methods
  this.fractionalize = fractionalize;
  this.orthogonalize = orthogonalize
  this.as_str = unit_cell_as_str;
}

function fractionalize (xyz) {
  var x = xyz[0], y = xyz[1], z = xyz[2];
  return [
    this.frac[0] * x + this.frac[1] * y + this.frac[2] * z,
    this.frac[4] * y + this.frac[5] * z,
    this.frac[8] * z
  ];
}

function orthogonalize (xyz) {
  var x = xyz[0], y = xyz[1], z = xyz[2];
  return [
    this.orth[0] * x + this.orth[1] * y + this.orth[2] * z,
    this.orth[4] * y + this.orth[5] * z,
    this.orth[8] * z
  ];
}

function unit_cell_as_str () {
  return "a=" + this.a + " b=" + this.b + " c=" + this.c +
         " alpha=" + this.alpha + " beta=" + this.beta + " gamma="+this.gamma;
}

//----------------------------------------------------------------------
// MAP GRID
function map_grid (nxyz) {
  this.nx = nxyz[0];
  this.ny = nxyz[1];
  this.nz = nxyz[2];
  this.size = this.nx * this.ny * this.nz;
  this.origin = [0,0,0];
  this.values = new Float32Array(this.size);
  // methods
  this.grid2index = grid2index;
  this.grid2frac = grid2frac;
  this.frac2grid = frac2grid;
  this.set_grid_value = set_grid_value;
  this.get_grid_value = get_grid_value;
}

function grid2index (i, j, k) {
  var i_ = i % this.nx;
  if (i_ < 0) {
    i_ += this.nx;
  }
  var j_ = j % this.ny;
  if (j_ < 0) {
    j_ += this.ny;
  }
  var k_ = k % this.nz;
  if (k_ < 0) {
    k_ += this.nz;
  }
  return (((i_ - this.origin[0]) * this.ny + (j_ - this.origin[1])) * this.nz +
          (k_ - this.origin[2]));
}

function grid2frac (i, j, k) {
  return [ (i + this.origin[0]) / this.nx,
           (j + this.origin[1]) / this.ny,
           (k + this.origin[2]) / this.nz ];
}

function frac2grid (x, y, z) {
  return [ Math.floor(x * this.nx) - this.origin[0],
           Math.floor(y * this.ny) - this.origin[1],
           Math.floor(z * this.nz) - this.origin[2] ];
}

function set_grid_value (i, j, k, value) {
  idx = this.grid2index(i, j, k);
  if (idx >= this.values.length) {
    throw Error("Array overflow with indices " + i + "," + j + "," + k);
  }
  this.values[idx] = value;
}

function get_grid_value (i, j, k, value) {
  idx = this.grid2index(i, j, k);
  if (idx >= this.values.length) {
    throw Error("Array overflow with indices " + i + "," + j + "," + k);
  }
  
  return this.values[idx];
}

//----------------------------------------------------------------------
// CCP4 MAP
// http://www.ccp4.ac.uk/html/maplib.html#description
function ccp4_map (mapdata) {
  console.log("Map data size: " + mapdata.length);
  this.mode = mapdata[3];
  this.dim = [ mapdata[7], mapdata[8], mapdata[9] ];
  var cellData = new ArrayBuffer(24);
  var cellIntData = new Int32Array(cellData);
  var cellFloatData = new Float32Array(cellData);
  cellIntData[0] = mapdata[10];
  cellIntData[1] = mapdata[11];
  cellIntData[2] = mapdata[12];
  cellIntData[3] = mapdata[13];
  cellIntData[4] = mapdata[14];
  cellIntData[5] = mapdata[15];
  this.unit_cell = new UnitCell(
    cellFloatData[0],
    cellFloatData[1],
    cellFloatData[2],
    cellFloatData[3],
    cellFloatData[4],
    cellFloatData[5]);
  this.min = mapdata[19];
  this.max = mapdata[20];
  this.mean = mapdata[21];
  this.sg_number = mapdata[22];
  this.lskflg = mapdata[24];
  n_crs = [ mapdata[0], mapdata[1], mapdata[2] ];
  var order_xyz = [
    mapdata[16] - 1,
    mapdata[17] - 1,
    mapdata[18] - 1,
  ];
  var origin = [ mapdata[4], mapdata[5], mapdata[6] ];
  this.origin = [
    origin[order_xyz[0]],
    origin[order_xyz[1]],
    origin[order_xyz[2]]
  ];
  this.grid = [
    n_crs[order_xyz[0]],
    n_crs[order_xyz[1]],
    n_crs[order_xyz[2]]
  ];
  this.data = new map_grid(this.grid);
  var i_crs = [0,0,0];
  var idx = 256;
  var section_size = n_crs[0] * n_crs[1];
  array_buffer = new ArrayBuffer(4);
  intData = new Int32Array(array_buffer);
  floatData = new Float32Array(array_buffer);
  for (i_crs[2] = 0; i_crs[2] < n_crs[2]; i_crs[2]++) {
    for (i_crs[1] = 0; i_crs[1] < n_crs[1]; i_crs[1]++) {
      for (i_crs[0] = 0; i_crs[0] < n_crs[0]; i_crs[0]++) {
        var i = i_crs[order_xyz[0]];
        var j = i_crs[order_xyz[1]];
        var k = i_crs[order_xyz[2]];
        intData[0] = mapdata[idx++];
        if (i_crs[0] == 5 && i_crs[1] == 5) {
          console.log(i + " " + j + " " + k);
          console.log(floatData[0]);
        }
        this.data.set_grid_value(i, j, k, floatData[0]);
  }}}
  if (idx != mapdata.length) {
    throw Error("Index does not match data length: " + idx + " vs. "+
                mapdata.length);
  }
  console.log("38,8,29: " + this.data.get_grid_value(38, 8, 29));
  if (true) {
    console.log("unit cell grid: " + this.dim);
    console.log("map origin: " + this.origin);
    console.log("map grid: " + this.grid);
    console.log(this.unit_cell.as_str());
  }
  // methods
  this.points_and_values = function (center, radius) {
    return new cartesian_map_data(this.unit_cell, this.data, center, radius);
  }
}

function cartesian_map_data (unit_cell, map_data, center, radius) {
  if (! center) {
    center = [0, 0, 0];
  }
  if (! radius) {
    radius = 5.0;
  }
  var xyz_min = [center[0] - radius, center[1] - radius, center[2] - radius];
  var xyz_max = [center[0] + radius, center[1] + radius, center[2] + radius];
  var frac_min = unit_cell.fractionalize(xyz_min);
  var frac_max = unit_cell.fractionalize(xyz_max);
  var grid_min = map_data.frac2grid(frac_min[0], frac_min[1], frac_min[2]);
  var grid_max = map_data.frac2grid(frac_max[0], frac_max[1], frac_max[2]);
  console.log("GRID RANGE: " + grid_min + ", " + grid_max);
  this.points = [];
  this.values = [];
  this.nx = grid_max[0] - grid_min[0] + 1;
  this.ny = grid_max[1] - grid_min[1] + 1;
  this.nz = grid_max[2] - grid_min[2] + 1;
  for (var k = grid_min[2]; k <= grid_max[2]; k++) {
    for (var j = grid_min[1]; j <= grid_max[1]; j++) {
      for (var i = grid_min[0]; i <= grid_max[0]; i++) {
        site_frac = map_data.grid2frac(i,j,k);
        site_cart = unit_cell.orthogonalize(site_frac);
        if (! site_cart) {
          throw Error("Site undefined for " + i + ","+j+","+k);
        }
        this.points.push( new THREE.Vector3(site_cart[0], site_cart[1],
                                            site_cart[2]) );
        map_value = map_data.get_grid_value(i,j,k);
        if (! map_value) {
          throw Error("oops: " + map_value);
        }
        this.values.push( map_data.get_grid_value(i,j,k) );
  }}}
  console.log("size: " + this.nx + ", " + this.ny + ", " + this.nz);
}

//----------------------------------------------------------------------
// MATH UTILITIES
function deg2rad (angle) {
  return angle * Math.PI / 180;
}

function distance (xyz1, xyz2) {
  return Math.sqrt(
    Math.pow(xyz2[0] - xyz1[0], 2) +
    Math.pow(xyz2[1] - xyz1[1], 2) +
    Math.pow(xyz2[2] - xyz1[2], 2));
}

function midpoint (xyz1, xyz2) {
  return [
    xyz1[0] + (xyz2[0] - xyz1[0]) / 2,
    xyz1[1] + (xyz2[1] - xyz1[1]) / 2,
    xyz1[2] + (xyz2[2] - xyz1[2]) / 2
  ];
}
