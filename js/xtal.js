var xtal = (function(module) {

//----------------------------------------------------------------------
// SYMMETRY OPERATORS
function Symops () {
  this.ops = [];
}

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
function GridArray (n_real, n_grid, origin) {
  this.n_real = n_real; // actual dimensions of the map area
  this.n_grid = n_grid; // dimensions of the grid for the entire unit cell
  this.origin = origin;
  this.size = this.n_real[0] * this.n_real[1] * this.n_real[2];
  this.values = new Float32Array(this.size);

  // methods
  this.grid2index = function (i, j, k) {
    var i_ = (i + this.origin[0]) % this.n_real[0];
    var j_ = (j + this.origin[1]) % this.n_real[1];
    var k_ = (k + this.origin[2]) % this.n_real[2];
    if (i_ < 0) {
      i_ += this.n_real[0];
    }
    if (j_ < 0) {
      j_ += this.n_real[1];
    }
    if (k_ < 0) {
      k_ += this.n_real[2];
    }
    return ((i_ * this.n_real[1] + j_ ) * this.n_real[2] + k_);
  }
  
  this.grid2frac = function (i, j, k) {
    return [ i / this.n_grid[0], j / this.n_grid[1], k / this.n_grid[2] ];
  }

  // return the equivalent grid coordinates (rounded down) for the given
  // fractional coordinates. 
  this.frac2grid = function (x, y, z) {
    return [ Math.floor(x * this.n_grid[0]),
             Math.floor(y * this.n_grid[1]),
             Math.floor(z * this.n_grid[2]) ];
  }
  
  this.set_grid_value = function (i, j, k, value) {
    idx = this.grid2index(i, j, k);
    if (idx >= this.size) {
      throw Error("Array overflow with indices " + i + "," + j + "," + k);
    }
    this.values[idx] = value;
  }
  
  this.get_grid_value = function (i, j, k, value) {
    idx = this.grid2index(i, j, k);
    if (idx >= this.size) {
      throw Error("Array overflow with indices " + i + "," + j + "," + k);
    }
    return this.values[idx];
  }

  this.sigma_scale = function () {
    var avg = average(this.values);
    for (var n = 0; n < this.size; n++) {
      this.values[n] = (this.values[n] - avg.mean) / avg.deviation;
    }
  }
}

//----------------------------------------------------------------------
// ELECTRON DENSITY MAP
function Map () {
  this.n_real = null;
  this.origin = null;
  this.unit_cell = null;
  this.data = null;

  // http://www.ccp4.ac.uk/html/maplib.html#description
  this.from_ccp4 = function (mapdata) {
    console.log("Map data size: " + mapdata.length);
    this.mode = mapdata[3];
    this.n_grid = [ mapdata[7], mapdata[8], mapdata[9] ];
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
    this.n_real = [
      n_crs[order_xyz[0]],
      n_crs[order_xyz[1]],
      n_crs[order_xyz[2]]
    ];
    this.data = new GridArray(this.n_real, this.n_grid, this.origin);
    var i_crs = [0,0,0];
    var idx = 256;
    var section_size = n_crs[0] * n_crs[1];
    var array_buffer = new ArrayBuffer(4);
    var intData = new Int32Array(array_buffer);
    var floatData = new Float32Array(array_buffer);
    for (i_crs[2] = 0; i_crs[2] < n_crs[2]; i_crs[2]++) {
      for (i_crs[1] = 0; i_crs[1] < n_crs[1]; i_crs[1]++) {
        for (i_crs[0] = 0; i_crs[0] < n_crs[0]; i_crs[0]++) {
          var i = i_crs[order_xyz[0]] + this.origin[0];
          var j = i_crs[order_xyz[1]] + this.origin[1];
          var k = i_crs[order_xyz[2]] + this.origin[2];
          intData[0] = mapdata[idx++];
          this.data.set_grid_value(i, j, k, floatData[0]);
    }}}
    if (idx != mapdata.length) {
      throw Error("Index does not match data length: " + idx + " vs. "+
                  mapdata.length);
    }
  }

  // DSN6 MAP FORMAT
  // http://www.uoxray.uoregon.edu/tnt/manual/node104.html
  // This format is much different from CCP4/MRC maps, and was obviously
  // designed for vastly more primitive computers.  Since density values are
  // stored as bytes rather than (4-byte) floates, it has the big advantage
  // of being significantly more compact than CCP4 maps.
  this.from_dsn6 = function (mapdata, no_sigma_scale) {
    var array_buffer = new ArrayBuffer(512);
    var headerBytes = new Uint8Array(array_buffer);
    var header = new Int16Array(array_buffer);
    for (var i = 0; i < 512; i++) {
      headerBytes[i] = mapdata[i];
    }
    if (header[18] != 100) {
      for (var i = 0; i < 256; i++) {
        headerBytes[(i*2)] = mapdata[(i*2)+1];
        headerBytes[(i*2)+1] = mapdata[i*2];
      }
    }
    if (header[18] != 100) {
      throw Error("Endian swap failed");
    }
    this.origin = [
      header[0],
      header[1],
      header[2]
    ];
    this.n_real = [
      header[3],
      header[4],
      header[5]
    ];
    this.n_grid = [
      header[6],
      header[7],
      header[8]
    ];
    var cell_scale_factor = header[17];
    this.unit_cell = new UnitCell(
      header[9] / cell_scale_factor,
      header[10] / cell_scale_factor,
      header[11] / cell_scale_factor,
      header[12] / cell_scale_factor,
      header[13] / cell_scale_factor,
      header[14] / cell_scale_factor
    );
    this.data = new GridArray(this.n_real, this.n_grid, this.origin);
    var prod = header[15] / 100;
    var plus = header[16];
    //var data_scale_factor = header[15] / header[18] + header[16];
    var idx = 512;
    var n_blocks = [
      Math.ceil(this.n_real[0] / 8),
      Math.ceil(this.n_real[1] / 8),
      Math.ceil(this.n_real[2] / 8)
    ];
    for(var zz = 0; zz < n_blocks[2]; zz++) {
      for(var yy = 0; yy < n_blocks[1]; yy++) {
        for(var xx = 0; xx < n_blocks[0]; xx++) { // outer loop
          var brick = new Uint8Array(512);
          // read an 8x8x8 brick, swapping bytes
          for (var i = 0; i < 256; i++) {
            brick[(i*2)] = mapdata[idx+(i*2)+1];
            brick[(i*2)+1] = mapdata[idx+i*2];
          }
          idx += 512;
          var i_byte = 0;
          for (var z = 0; z < 8; z++) {
            for (var y = 0; y < 8; y++) {
              for (var x = 0; x < 8; x++) { // inner loop
                var i_ = (xx * 8) + x;
                var j_ = (yy * 8) + y;
                var k_ = (zz * 8) + z;
                if ((i_ < this.n_real[0]) && (j_ < this.n_real[1]) &&
                    (k_ < this.n_real[2])) {
                  var i = i_ + this.origin[0];
                  var j = j_ + this.origin[1];
                  var k = k_ + this.origin[2];
                  var density = (brick[i_byte] - plus) / prod;
                  this.data.set_grid_value(i, j, k, density);
                }
                i_byte += 1;
          }}} // end inner loop
    }}} // end outer loop
    /*var dmin = 10000000, dmax = -1000000;
    for (var i = 0; i < this.data.size; i++) {
      var val = this.data.values[i];
      if (*/
    if (! no_sigma_scale) this.data.sigma_scale();
  }

  this.show = function () {
    console.log("map origin: " + this.origin);
    console.log("map size: " + this.n_real);
    console.log("unit cell grid: " + this.n_grid);
    console.log(this.unit_cell.as_str());
  }

  this.points_and_values = function (center, radius) {
    return new cartesian_map_data(this.unit_cell, this.data, center, radius);
  }
}

// Extract a block of density for calculating an isosurface using the
// separate marching cubes implementation.  Unlike the rest of this module,
// this function explicitly uses Three.js (although this is not absolutely
// necessary).
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
  this.points = [];
  this.values = [];
  var nx = grid_max[0] - grid_min[0] + 1;
  var ny = grid_max[1] - grid_min[1] + 1;
  var nz = grid_max[2] - grid_min[2] + 1;
  this.size = [nx, ny, nz];
  for (var k = grid_min[2]; k <= grid_max[2]; k++) {
    for (var j = grid_min[1]; j <= grid_max[1]; j++) {
      for (var i = grid_min[0]; i <= grid_max[0]; i++) {
        site_frac = map_data.grid2frac(i,j,k);
        site_cart = unit_cell.orthogonalize(site_frac);
        if (! site_cart) {
          throw Error("Site undefined for " + i + ","+j+","+k);
        }
        //this.points.push( [ site_cart[0], site_cart[1], site_cart[2] ] );
        this.points.push( new THREE.Vector3(site_cart[0], site_cart[1], site_cart[2] ) );
        map_value = map_data.get_grid_value(i,j,k);
        if (map_value == null) {
          throw Error("oops: " + map_value + " (" + i+","+j+","+k+")");
        }
        this.values.push( map_data.get_grid_value(i,j,k) );
  }}}
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

// https://gist.github.com/matthutchinson/1648603
average = function(a) {
  var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
  for(var m, s = 0, l = t; l--; s += a[l]);
  for(m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
  return r.deviation = Math.sqrt(r.variance = s / t), r;
}

// Exports
return {
	'UnitCell': UnitCell,
	'Map': Map,
	'midpoint': midpoint,
	'distance': distance,
	'deg2rad': deg2rad,
	// 'fractionalize': fractionalize,
	// 'orthogonalize': orthogonalize,
	// 'unit_cell_as_str': unit_cell_as_str,
	// 'map_grid': map_grid,
	// 'grid2index': grid2index,
	// 'grid2frac': grid2frac,
	// 'frac2grid': frac2grid,
	// 'set_grid_value': set_grid_value,
	// 'get_grid_value': get_grid_value,
	// 'cartesian_map_data': cartesian_map_data,
}
})(xtal||{});
