/*

xtal.js PDB & CIF models.

Dependencies:
  xtal.js
  xtal.cif.js (implicitly)
  Three.js (optionally)

Exports:
	Atom
	Model
	Cubicle

*/
var xtal = (function(module) {return module})(xtal||{});
xtal.model = (function(module) {

var eight_pi_squared = 8 * 3.14159 * 3.14159; // B = 8 * pi^2 * u^2
var max_bond_length = 1.99;
var max_bond_length_h = 1.3;
var max_bond_length_SP = 2.2;
var anisou_factor = 1.e-4;

var elements = [
  "H", "HE", "LI", "BE", "B", "C", "N", "O", "F", "NE", "NA", "MG",
  "AL", "SI", "P", "S", "CL", "AR", "K", "CA", "SC", "TI", "V", "CR",
  "MN", "FE", "CO", "NI", "CU", "ZN", "GA", "GE", "AS", "SE", "BR",
  "KR", "RB", "SR", "Y", "ZR", "NB", "MO", "TC", "RU", "RH", "PD",
  "AG", "CD", "IN", "SN", "SB", "TE", "I", "XE", "CS", "BA", "LA",
  "CE", "PR", "ND", "PM", "SM", "EU", "GD", "TB", "DY", "HO", "ER",
  "TM", "YB", "LU", "HF", "TA", "W", "RE", "OS", "IR", "PT", "AU",
  "HG", "TL", "PB", "BI", "PO", "AT", "RN", "FR", "RA", "AC", "TH",
  "PA", "U", "NP", "PU", "AM", "CM", "BK", "CF", "ES", "FM", "MD",
  "NO", "LR", "RF", "DB", "SG", "BH", "HS", "MT", "DS", "RG"
];
var non_ionic = ["H", "B", "C", "N", "O", "SI", "S", "P", "SE"];

var amino_acids = [
  "ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE", "LEU",
  "LYS", "MET", "MSE", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL", "UNK"
];
var nucleic_acids = [
  "DA", "DC", "DG", "DT", "A", "C", "G", "U", "rA", "rC", "rG", "rU",
  "Ar", "Cr", "Gr", "Ur"
];

// Container for a single model (assumed right now to be a complete PDB, mmCIF,
// or other CIF file - no multi-MODEL files allowed right now).
function Model (pdb_string) {
  this._atoms = [];
  this._chains = null;
  this.chain_indices = [];
  this.unit_cell = null;
  this.space_group = null;
  this.has_hydrogens = false;
  this.ligand_flags = null;
  this.connectivity = null;
  this.atom_lookup = null;
  this.source = null;

  // Initialize from mmCIF model
  this.from_mmcif = function(cif_block) {
    this.source = "mmcif";
    var chain_index = 0;
    var last_chain = null;
		var atoms = cif_block.loop_dict('_atom_site');
		for (var i=0;i<atoms.length;i++) {
      var atom = new Atom();
      atom.from_mmcif(atoms[i]);
      atom.i_seq = i;
      // Setup atom...
      this._atoms.push(atom);
      // Update the chain.
      if (atom.chain != last_chain) {
        chain_index++;
      }
      this.chain_indices.push(chain_index);
      last_chain = atom.chain;
    }
    // Update connectivity.
    if (this._atoms.length == 0) {
      throw Error("No atom records found.")
    }
    // attempt to extract unit cell information
    var uc_ = [
        cif_block.get("_cell.length_a"),
        cif_block.get("_cell.length_b"),
        cif_block.get("_cell.length_c"),
        cif_block.get("_cell.angle_alpha"),
        cif_block.get("_cell.angle_beta"),
        cif_block.get("_cell.angle_gamma")
    ];
    this.process_unit_cell_params(uc_);
    this.space_group = cif_block.get('_symmetry.space_group_name_H-M');
    this.connectivity = get_connectivity_fast(this._atoms);
  }

  // Initialize from small molecule CIF - *not* the same as mmCIF!
  this.from_cif = function(cif_block) {
    this.source = "cif";
    var uc_ = [
      cif_block.get("_cell_length_a"),
      cif_block.get("_cell_length_b"),
      cif_block.get("_cell_length_c"),
      cif_block.get("_cell_angle_alpha"),
      cif_block.get("_cell_angle_beta"),
      cif_block.get("_cell_angle_gamma"),
    ];
    if (! this.process_unit_cell_params(uc_)) {
      throw Error("Can't extract unit cell - required for small molecules.");
    }
    this.space_group = cif_block.get('_symmetry_space_group_name_H-M');
    var labels = cif_block.get('_atom_site_label');
    var elements = cif_block.get('_atom_site_type_symbol');
    var frac_x = cif_block.get('_atom_site_fract_x');
    var frac_y = cif_block.get('_atom_site_fract_y');
    var frac_z = cif_block.get('_atom_site_fract_z');
    var u_iso = cif_block.get('_atom_site_U_iso_or_equiv');
    var occ = cif_block.get('_atom_site_occupancy');
    for (var i = 0; i < labels.length; i++) {
      var atom = new Atom();
      atom.i_seq = i;
      atom.name = labels[i];
      atom.element = elements[i];
      atom._u_iso = u_iso[i];
      atom.b = u_iso[i] * u_iso[i] * eight_pi_squared;
      atom.occ = occ[i];
      atom.xyz = this.unit_cell.orthogonalize((frac_x[i],frac_y[i],frac_z[i]));
      this._atoms.push(atom);
    }
    if (this._atoms.length == 0) {
      throw Error("No atom records found.")
    }
    // TODO use built-in bonding - is this always available?
    this.connectivity = get_connectivity_fast(this._atoms);
  }
	
  // Initialize from mmCIF model
  this.from_monlib = function(cif_block) {
    this.source = "monlib";
    var chain_index = 0;
    var last_chain = null;
		var atoms = cif_block.loop_dict('_chem_comp_atom');
		for (var i=0;i<atoms.length;i++) {
      var atom = new Atom();
			atom.from_monlib(atoms[i]);
      atom.i_seq = i;
      // Setup atom...
      this._atoms.push(atom);
      // Update the chain.
      if (atom.chain != last_chain) {
        chain_index++;
      }
      this.chain_indices.push(chain_index);
      last_chain = atom.chain;
    }
    // Update connectivity.
    if (this._atoms.length == 0) {
      throw Error("No atom records found.")
    }
    this.connectivity = get_connectivity_fast(this._atoms);
    this.atom_lookup = build_atom_name_dict(this._atoms);
  }

  // Initialize from PDB string
  this.from_pdb = function(pdb_string) {
    this.source = "pdb";
    console.log("from_pdb");
    var lines = pdb_string.split("\n");
    var chain_index = 0;
    var last_chain = null;
    var atom_i_seq = 0; 
    var last_atom = null;
    for (var i = 0; i < lines.length; i++) {
      line = lines[i];
      var rec_type = line.substring(0,6);
      if (rec_type == "ATOM  " || rec_type == "HETATM") {
        var new_atom = new Atom() 
        new_atom.from_pdb_line(line);
        new_atom.i_seq = atom_i_seq++;
        this._atoms.push(new_atom);
        if ((! this.has_hydrogens) && (new_atom.element == "H")) {
          this.has_hydrogens = true;
        }
        if (new_atom.chain != last_chain) {
          chain_index++;
        }
        this.chain_indices.push(chain_index);
        last_chain = new_atom.chain;
        last_atom = new_atom;
      } else if (rec_type == "ANISOU") {
        last_atom.set_uij_from_anisou(line);
      } else if (rec_type == "CRYST1") {
        var a = parseFloat(line.substring(6, 15));
        var b = parseFloat(line.substring(15, 24));
        var c = parseFloat(line.substring(24, 33));
        var alpha = parseFloat(line.substring(33, 40));
        var beta = parseFloat(line.substring(40, 47));
        var gamma = parseFloat(line.substring(47, 54));
        var sg_symbol = line.substring(55, 66);
        this.unit_cell = new xtal.UnitCell(a, b, c, alpha, beta, gamma);
      } else if (rec_type.substring(0, 3) == "TER") {
        chain_index++;
      }
    }
    if (this._atoms.length == 0) {
      throw Error("No atom records found.")
    }

    //this.connectivity = get_connectivity_simple(this.atoms);
    this.connectivity = get_connectivity_fast(this._atoms);
  }

  // create a unit cell object from parameters
  this.process_unit_cell_params = function (uc_) {
    var uc = [];
    for (var i = 0; i < 6; i++) {
      if (! uc_[i]) {
        break;
      } else {
        // values are assumed to be strictly numeric by this point
        uc.push(parseInt(uc_[i]));
      }
    }
    if (uc.length == 6) {
      this.unit_cell = new xtal.UnitCell(uc[0],uc[1],uc[2],uc[3],uc[4],uc[5]);
      return true;
    }
    return false;
  }
  this.atoms = function () {
    return this._atoms;
  } 
  this.residues = function () {
    return []; // TODO
  }
  this.chains = function () {
    if (this._chains == null) {
      this._chains = [];
      var last_chain_index = null;
      var chain_atoms = null;
      for (var i = 0; i < this._atoms.length; i++) {
        var chain_index = this.chain_indices[i];
        if (chain_index != last_chain_index) {
          if (chain_atoms != null) {
            this._chains.push(new Chain(chain_atoms));
          }
          chain_atoms = []
        }
        chain_atoms.push(this._atoms[i]);
        last_chain_index = chain_index;
      }
      this._chains.push(new Chain(chain_atoms));
    }
    return this._chains;
  }
  this.extract_trace = function () {
    return extract_trace(this);
  }
  this.extract_ligands = function () {
    if (this.ligand_flags == null) {
      this.ligand_flags = [];
      for (var i = 0; i < this._atoms.length; i++) {
        var atom = this._atoms[i];
        if ((! atom.is_water()) && (amino_acids.indexOf(atom.resname) < 0) &&
            (nucleic_acids.indexOf(atom.resname) < 0)) {
          this.ligand_flags.push(true);
        } else {
          this.ligand_flags.push(false);
        }
      }
    }
    return this.ligand_flags;
  }

  this.select_atom_names = function (atom_names) {
    var selection = [];
    console.log(atom_names, atom_names.length);
    for (var j = 0; j < atom_names.length; j++) {
      console.log(atom_names[j]);
      selection.push(this.atom_lookup[atom_names[j]]);
    }
    return selection;
  }

  this.selection = function (selection_str) {
    var selection = [];
    var selector = new AtomSelector(selection_str);
    for (var i = 0; i < this._atoms.length; i++) {
      if (selector.is_in_selection(this._atoms[i])) {
        console.log("A");
        selection.push(i);
      }
    }
    console.log(selection.length);
    return selection;
  }

  this.extract_interesting_residues = function () {
    return extract_interesting_residues(this);
  }

  this.update_atoms = function (other) {
    this._atoms = other.atoms();
    this.chain_indices = other.chain_indices;
    this.connectivity = other.connectivity;
    this.has_hydrogens = other.has_hydrogens;
    this.ligand_flags = null;
    return this;
  }

  this.get_center_and_size = function () {
    var xsum = 0, ysum = 0, zsum = 0, n_atoms = this._atoms.length;
    var xmax = -99999, xmin = 99999;
    var ymax = -99999, ymin = 99999;
    var zmax = -99999, zmin = 99999;
    for (var i = 0; i < n_atoms; i++) {
      var x = this._atoms[i].xyz[0], y = this._atoms[i].xyz[1],
          z = this._atoms[i].xyz[2];
      xsum += x;
      ysum += y;
      zsum += z;
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > xmax) ymax = y;
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
    var xrange = Math.abs(xmax - xmin);
    var yrange = Math.abs(ymax - ymin);
    var zrange = Math.abs(zmax - zmin);
    return [ [xsum/n_atoms, ysum/n_atoms, zsum/n_atoms],
             Math.max(xrange, yrange, zrange) ];
  }
}

// Single atom and associated labels
function Atom (pdb_line) {
  this.hetero = false;
  this.name = "";
  this.altloc = "";
  this.resname = "";
  this.chain = "";
  this.resseq = "";
  this.xyz = [0, 0, 0];
  this.occ = 1.0;
  this.b = 0;
  this._u_iso = null;
  this.uij = null;
  this._sphere_transform = null; // cached for anisotropic ellipsoid drawing
  this.element = "";
  this.charge = 0;
  this.i_seq = null;
  
  this.from_mmcif = function(m) {
    if (m['group_pdb'] == "HETATM") {
      this.hetero = true;
    }
    this.name = m['label_atom_id'];
    this.altloc = m['label_alt_id'];
    if (this.altloc == '.') this.altloc = "";
    this.resname = m['label_comp_id'];
    this.chain = m['label_asym_id'];
    this.resseq = m['label_entity_id'];
    this.icode = m['label_seq_id'];
    var x = m['cartn_x'];
    var y = m['cartn_y'];
    var z = m['cartn_z'];
    this.xyz = [x, y, z];
    this.occ = m['occupancy'];
    this.b = m['b_iso_or_equiv'];
    this.element = m['type_symbol'];
    this.charge = m['pdbx_formal_charge'];
  }
  
	this.from_monlib = function(m) {
    var x = m['x'];
    var y = m['y'];
    var z = m['z'];
    this.name = m['atom_id'];
    this.xyz = [x, y, z];
    this.element = m['type_symbol'];
    this.charge = m['partial_charge'];
	}

  // http://www.wwpdb.org/documentation/format33/sect9.html#ATOM	
  this.from_pdb_line = function(pdb_line) {
    if (pdb_line.length < 66) {
      throw Error("ATOM or HETATM record is too short: " + pdb_line);
    }
    var rec_type = pdb_line.substring(0, 6);
    if (rec_type == "HETATM") {
      this.hetero = true;
    } else if (rec_type != "ATOM  ") {
      throw Error("Wrong record type: " + rec_type);
    }
    this.name = pdb_line.substring(12,16).trim();
    this.altloc = pdb_line.substring(16, 17).trim();
    this.resname = pdb_line.substring(17, 20).trim();
    this.chain = pdb_line.substring(20, 22).trim();
    this.resseq = pdb_line.substring(22, 26);
    this._resseq_as_int = null;
    this.icode = pdb_line.substring(26, 27).trim();
    var x = parseFloat(pdb_line.substring(30, 38));
    var y = parseFloat(pdb_line.substring(38, 46));
    var z = parseFloat(pdb_line.substring(46, 54));
    this.xyz = [ x, y, z ];
    this.occ = parseFloat(pdb_line.substring(54, 60));
    this.b = parseFloat(pdb_line.substring(60, 66));
    if (pdb_line.length >= 78) {
      this.element = pdb_line.substring(76, 78).trim().toUpperCase();
    }
    if (pdb_line.length >= 80) {
      this.charge = pdb_line.substring(78, 80).trim();
    }
  }

  // http://www.wwpdb.org/documentation/format33/sect9.html#ANISOU
  this.set_uij_from_anisou = function (pdb_line) {
    var rec_type = line.substring(0, 6);
    if (rec_type != "ANISOU") {
      throw Error("Wrong record type: " + rec_type);
    }
    var name = pdb_line.substring(12,16).trim();
    var altloc = pdb_line.substring(16, 17).trim();
    var resname = pdb_line.substring(17, 20).trim();
    var chain = pdb_line.substring(20, 22).trim();
    var resseq = pdb_line.substring(22, 26);
    var icode = pdb_line.substring(26, 27).trim();
    if ((name != this.name) || (altloc != this.altloc) ||
        (resname != this.resname) || (chain != this.chain) ||
        (resseq != this.resseq) || (icode != this.icode)) {
      throw Error("Mismatch to ATOM record: " + pdb_line);
    }
    this.uij = [
      parseInt(pdb_line.substring(28, 35)) * anisou_factor,
      parseInt(pdb_line.substring(35, 42)) * anisou_factor,
      parseInt(pdb_line.substring(42, 49)) * anisou_factor,
      parseInt(pdb_line.substring(49, 56)) * anisou_factor,
      parseInt(pdb_line.substring(56, 63)) * anisou_factor,
      parseInt(pdb_line.substring(63, 70)) * anisou_factor
    ];
  }

  this.resseq_as_int = function () {
    if (this._resseq_as_int == null) {
      this._resseq_as_int = parseInt(this.resseq);
    }
    return this._resseq_as_int;
  }
  this.resid = function () {
    return this.resseq + this.icode;
  }
  this.b_as_u = function () {
    if (this._u_iso == null) {
      this._u_iso = Math.sqrt(this.b / eight_pi_squared);
    }
    return this._u_iso;
  }
  this.distance = function (other) {
    return xtal.distance(this.xyz, other.xyz);
  }
  this.midpoint = function (other) {
    return xtal.midpoint(this.xyz, other.xyz);
  }
  this.is_hydrogen = function () {
    return this.element == "H" || this.element == "D";
  }
  this.is_s_or_p = function () {
    return this.element == "S" || this.element == "P";
  }
  this.is_ion = function () {
    return this.element == this.resname;
  }
  this.is_water = function () {
    return this.resname == "HOH";
  }
  // XXX requires Three.js
  this.as_vec3 = function () {
    return new THREE.Vector3().fromArray(this.xyz);
  }
  this.is_same_residue = function (other, ignore_altloc) {
    if ((other.resseq != this.resseq) || (other.icode != this.icode) ||
        (other.chain != this.chain) || (other.resname != this.resname) ||
        ((! ignore_altloc) && (other.altloc != this.altloc))) {
      return false;
    }
    return true;
  }
  this.is_same_conformer = function (other) {
    if ((this.altloc == "") || (other.altloc == "") ||
        (this.altloc == other.altloc)) {
      return true;
    }
    return false;
  }
  this.is_main_conformer = function () {
    return ((this.altloc == "") || (this.altloc == "A"));
  }
  this.is_bonded_to = function (other) {
    if (! this.is_same_conformer(other)) return false;
    if ((this.element == "H") && (other.element == "H")) return false;
    var dxyz = this.distance(other);
    if ((this.element == "H") || (other.element == "H")) {
      if (dxyz <= max_bond_length_h) {
        return true;
      }
    } else if (dxyz <= max_bond_length) {
      return true;
    } else if (dxyz < max_bond_length_SP) {
      if (this.is_s_or_p() || other.is_s_or_p()) {
        return true;
      }
    }
    return false;
  }

  // 4x4 matrix used to display thermal ellipsoids; since this involves
  // significant overhead due to calculation of eigenvalues and eigenvectors,
  // the result is cached.
  this.ellipsoid_to_sphere_transform = function () {
    if (this._sphere_transform == null) {
      this._sphere_transform = xtal.ellipsoid_to_sphere_transform(this.uij,
        this.xyz);
    }
    return this._sphere_transform;
  }
}

// Memoization of atom neighbors for fast connectivity determination.  Atoms
// are grouped into boxes of a set size (not much longer than the maximum
// expected bond length), and the box index for each atom is stored in a list.
// Searching for neighbors only requires that we examine this box and the 15
// neighboring boxes.
function Cubicles (atoms, box_length) {
  box_length = box_length || 3;
  var xcoords = [];
  var ycoords = [];
  var zcoords = [];
  for (var i = 0; i < atoms.length; i++) {
    xcoords.push(atoms[i].xyz[0]);
    ycoords.push(atoms[i].xyz[1]);
    zcoords.push(atoms[i].xyz[2]);
  }
  this.box_length = box_length;
  var eps = 0.001;
  this.xmin = Math.min.apply(null, xcoords) - eps;
  this.xmax = Math.max.apply(null, xcoords) + eps;
  this.ymin = Math.min.apply(null, ycoords) - eps;
  this.ymax = Math.max.apply(null, ycoords) + eps;
  this.zmin = Math.min.apply(null, zcoords) - eps;
  this.zmax = Math.max.apply(null, zcoords) + eps;
  console.log("xrange: " + this.xmin + " - " + this.xmax);
  console.log("yrange: " + this.ymin + " - " + this.ymax);
  console.log("zrange: " + this.zmin + " - " + this.zmax);
  this.boxes = [];
  this.atom_lookup = [];
  var x = this.xmin, y = this.ymin, z = this.zmin;
  this.xdim = Math.ceil((this.xmax - this.xmin) / box_length);
  this.ydim = Math.ceil((this.ymax - this.ymin) / box_length);
  this.zdim = Math.ceil((this.zmax - this.zmin) / box_length);
  console.log("Dimensions: " + this.xdim + "x" + this.ydim + "x" + this.zdim);
  this.xydim = this.xdim * this.ydim;
  var nxyz = this.xydim * this.zdim;
  for (var i = 0; i < nxyz; i++) {
    this.boxes.push([]);
  }
  this.get_box_index = function (xyz) {
    var xstep = Math.floor((xyz[0] - this.xmin) / box_length);
    var ystep = Math.floor((xyz[1] - this.ymin) / box_length);
    var zstep = Math.floor((xyz[2] - this.zmin) / box_length);
    var box_id = (zstep * this.xydim) + (ystep*this.xdim) + xstep;
    return box_id;
  }
  for (var i = 0; i < atoms.length; i++) {
    var box_id = this.get_box_index(atoms[i].xyz);
    if ((box_id >= this.boxes.length) || (box_id < 0)) {
      throw Error("Box ID " + box_id + " is out of bounds (nboxes = " +
                  this.boxes.length + ")");
    }
    this.boxes[box_id].push(i);
    this.atom_lookup.push(box_id);
  }
  this.get_box_grid_coords = function (box_id) {
    var uv = Math.max(box_id % this.xydim, 0);
    var u = Math.max(uv % this.xdim, 0);
    var v = Math.floor(uv / this.xdim);
    var w = Math.floor(box_id / this.xydim);
    return [u, v, w];
  }
  this.get_nearby_atoms = function (idx) {
    var indices = [];
    var box_id = this.atom_lookup[idx];
    var uvw = this.get_box_grid_coords(box_id);
    var reverse = ((uvw[2] * this.xydim) + (uvw[1] * this.xdim) + uvw[0]);
    if (reverse != box_id) {
      throw Error(reverse);
    }
    var found = false;
    for (var u = (uvw[0] - 1); u <= (uvw[0] + 1); u++) {
      if ((u < 0) || (u >= this.xdim)) continue;
      for (var v = (uvw[1] - 1); v <= (uvw[1] + 1); v++) {
        if ((v < 0) || (v >= this.ydim)) continue;
        for (var w = (uvw[2] - 1); w <= (uvw[2] + 1); w++) {
          if ((w < 0) || (w >= this.zdim)) continue;
          var other_box_id = (w * this.xydim) + (v * this.xdim) + u;
          if ((other_box_id >= this.boxes.length) || (other_box_id < 0)) {
            throw Error("Box ID " + other_box_id +
              " is out of bounds (nboxes = " + this.boxes.length + ")");
          }
          for (var i = 0; i < this.boxes[other_box_id].length; i++) {
            other_id = this.boxes[other_box_id][i];
            if (other_id != idx) {
              indices.push(other_id);
            } else {
              found = true;
            }
          }
        }
      }
    }
    if (! found) {
      throw Error("Atom " + idx + " not found (box_id = " + box_id + ", "+
        "uvw = " + uvw + ")");
    }
    return indices;
  }
}

// O(n^2) loop, for testing purposes only
function get_connectivity_simple (atoms) {
  var connectivity = [];
  for (var i = 0; i < atoms.length; i++) connectivity.push([]);
  for (var i = 0; i < atoms.length; i++) {
    for (var j = i+1; j < atoms.length; j++) {
      if (atoms[i].is_bonded_to(atoms[j])) {
        connectivity[i].push(j);
        connectivity[j].push(i);
      }
    }
  }
  return connectivity;
}

function get_connectivity_fast (atoms) {
  var connectivity = [];
  var cubes = new Cubicles(atoms);
  for (var i = 0; i < atoms.length; i++) connectivity.push([]);
  for (var i = 0; i < atoms.length; i++) {
    var nearby_atoms = cubes.get_nearby_atoms(i);
    for (var k = 0; k < nearby_atoms.length; k++) {
      var j = nearby_atoms[k];
      if (atoms[i].is_bonded_to(atoms[j])) {
        connectivity[i].push(j);
        connectivity[j].push(i);
      }
    }
  }
  return connectivity;
}

function build_atom_name_dict (atoms) {
  var dict = [];
  for (var i = 0; i < atoms.length; i++) {
    var name = atoms[i].name;
    if (dict[name]) {
      throw Error("Duplicate atom " + name);
    }
    dict[name] = i;
  }
  return dict;
}

function extract_trace (model) {
  var segments = [];
  var current_segment = [];
  var last_chain_index = null;
  var last_atom_index = null;
  for (var i = 0; i < model.atoms().length; i++) {
    var atom = model.atoms()[i];
    var chain_index = model.chain_indices[i];
    var start_new = false;
    if ((atom.altloc != "") && (atom.altloc != "A")) continue;
    if ((atom.name == "CA" && atom.element == "C") || (atom.name == "P")) {
      if ((last_atom_index != null) && (last_chain_index == chain_index)) {
        var dxyz = atom.distance(model.atoms()[last_atom_index]);
        if (((atom.name == "CA") && (dxyz <= 5.5)) ||
            ((atom.name == "P") && (dxyz < 7.5))) {
          current_segment.push(atom);
          last_chain_index = chain_index;
          last_atom_index = i;
        } else {
          start_new = true;
        }
      } else {
        start_new = true;
      }
      if (start_new) {
        current_segment = [atom];
        segments.push(current_segment);
        last_chain_index = chain_index;
        last_atom_index = i;
      }
    }
  }
  //console.log(segments.length + " segments in initial run");
  var filtered = [];
  for (var i = 0; i < segments.length; i++) {
    if (segments[i].length > 2) {
      //console.log("segment: " + segments[i].length);
      filtered.push(segments[i]);
    }
  }
  //console.log(segments.length + " segments extracted");
  return filtered;
}

function extract_interesting_residues (model) {
  var residues = [];
  var current_atoms = null;
  var last_atom = null;
  for (var i = 0; i < model.atoms().length; i++) {
    var atom = model.atoms()[i];
    if ((atom.resname != "HOH") &&
        (amino_acids.indexOf(atom.resname) < 0) &&
        (nucleic_acids.indexOf(atom.resname) < 0)) {
      if ((! last_atom) || (! atom.is_same_residue(last_atom, true))) {
        current_atoms = [ atom ];
        residues.push(current_atoms);
      } else {
        current_atoms.push(atom);
      }
      last_atom = atom;
    }
  }
  var features = [];
  for (var i = 0; i < residues.length; i++) {
    if (residues[i].length == 0) {
      throw Error("Empty atom list");
    }
    var atom = residues[i][0];
    var feature_type = "ligand";
    if ((residues[i].length == 1) && (elements.indexOf(atom.resname) >= 0)) {
      feature_type = "ion";
    }
    var feature_name = sprintf("%3s %2s %4d%1s", atom.resname, atom.chain,
      atom.resseq, atom.icode);
    var xsum = 0, ysum = 0, zsum = 0;
    for (var j = 0; j < residues[i].length; j++) {
      var atom = residues[i][j];
      xsum += atom.xyz[0];
      ysum += atom.xyz[1];
      zsum += atom.xyz[2];
    }
    var xmean = xsum /residues[i].length;
    var ymean = ysum /residues[i].length;
    var zmean = zsum /residues[i].length;
    features.push([ feature_type+": "+feature_name, [xmean, ymean, zmean] ]);
  }
  return features;
}

//----------------------------------------------------------------------
// ATOM SELECTIONS
function AtomSelector (selection_str) {
  this.selection_str = selection_str;
  this.chains = null;
  this.resnames = null;
  this.resseqs = null;
  this.atom_names = null;
  var clauses = selection_str.split(" ");
  if (clauses.length == 0) {
    throw Error("Empty selection string");
  }
  for (var i = 0; i < clauses.length; i++) {
    var pair = clauses[i].split("=");
    var sel_type = pair[0];
    var sel_fields = pair[1].split(",");
    if (sel_fields.length == 0) {
      throw Error("Misformed selection '" + clauses[i] + "'");
    }
    if (sel_type == "chain") {
      if (this.chains == null) {
        this.chains = [];
      }
      for (var j = 0; j < sel_fields.length; j++) {
        validate_selection_field(sel_fields[j], "chain ID", 2);
        this.chains.push(sel_fields[j]);
      }
    } else if (sel_type.substring(0, 6) == "resnam") {
      if (this.resnames == null) {
        this.resnames = [];
      }
      for (var j = 0; j < sel_fields.length; j++) {
        validate_selection_field(sel_fields[j], "residue name", 3);
        this.resnames.push(sel_fields[j]);
      }
    } else if (sel_type == "resi" || sel_type == "resseq") {
      if (this.resseqs == null) {
        this.resseqs = [];
      }
      for (var j = 0; j < sel_fields.length; j++) {
        var resseq_range = sel_fields[j].split("-");
        if (resseq_range.length == 1) {
          validate_selection_field(sel_fields[j], "residue number", 4);
          var range = [ parseInt(sel_fields[j]),parseInt(sel_fields[j]) ];
          this.resseqs.push(range);
        } else if (resseq_range.length == 2) {
          var range = [ parseInt(resseq_range[0]),parseInt(resseq_range[1]) ];
          this.resseqs.push(range);
        } else {
          throw Error("Invalid residue range '" + sel_fields[j] + "'");
        }
      }
    } else if (sel_type == "name") {
      if (this.atom_names == null) {
        this.atom_names = [];
      }
      for (var j = 0; j < sel_fields.length; j++) {
        validate_selection_field(sel_fields[j], "atom name", 4);
        this.atom_names.push(sel_fields[j]);
      }
    } else {
      throw Error("Unrecognized selector token '" + sel_type + "'");
    }
  }

  this.is_in_selection = function (atom) {
    var allow_chain = (this.chains == null)
    var allow_resname = (this.resnames == null);
    var allow_resseq = (this.resseqs == null);
    var allow_name = (this.atom_names == null);
    if (this.chains != null) {
      for (var i = 0; i < this.chains.length; i++) {
        if (atom.chain == this.chains[i]) {
          allow_chain = true;
          break;
        }
      }
      if (! allow_chain) return false;
    }
    if (this.resnames != null) {
      for (var i = 0; i < this.resnames.length; i++) {
        if (atom.resname == this.resnames[i]) {
          allow_resname = true;
          break;
        }
      }
      if (! allow_resname) return false;
    }
    if (this.resseqs != null) {
      for (var i = 0; i < this.resseqs.length; i++) {
        var range = this.resseqs[i];
        if (range[0] <= atom.resseq_as_int() <= range[1]) {
          allow_resseq = true;
          break;
        }
      }
      if (! allow_resseq) return false;
    }
    if (this.atom_names != null) {
      for (var i = 0; i < this.atom_names.length; i++) {
        if (atom.name == this.atom_names[i]) {
          allow_name = true;
          break;
        }
      }
      if (! allow_name) return false;
    }
    return true;
  }
}

function validate_selection_field (sel_field, sel_type, max_size) {
  if (! (0 < sel_field <= max_size)) {
    throw Error("Bad " + sel_type + " '" + sel_fields + "'");
  }
}

//----------------------------------------------------------------------
// SIMPLE HIERARCHY OBJECTS

// Grouping for atoms in the same residue.
function Residue () {
  this._atoms = [];

  this.n_atoms = function () {
    return this._atoms.length;
  }
  this.atoms = function () {
    return this._atoms;
  }
  this.append_atom = function (atom) {
    this._atoms.push(atom);
  }
  this.get_atom = function (name, altloc) {
    for (var i = 0; i < this._atoms.length; i++) {
      var atom = this._atoms[i];
      if ((atom.name == name) && ((atom.altloc == altloc) ||
          ((altloc == null) && atom.is_main_conformer()))) {
        return atom;
      }
    }
    return null;
  }
}

// Grouping for atoms in the same chain - internally these will be organized
// as Residue objects.
function Chain (atoms) {
  this._residues = [];
  this.id = atoms[0].chain;
  var current_residue = null;
  var last_atom = null, last_resid = null;
  for (var i = 0; i < atoms.length; i++) {
    var atom = atoms[i];
    var resid = atom.resid();
    if (resid != last_resid) {
      current_residue = new Residue();
      this._residues.push(current_residue);
      current_residue.append_atom(atom);
      last_resid = resid;
    } else {
      current_residue.append_atom(atom);
    }
  }
  this.residues = function () {
    return this._residues;
  }
  this.atoms = function () {
    var atoms_ = [];
    for (var i = 0; i < this._residues.length; i++) {
      atoms_.push(this._residues[i].atoms());
    }
    return atoms_;
  }
}

// Exports into xtal.model
return {
	'Model': Model,
	'Atom': Atom,
	'Cubicles': Cubicles
}
})(xtal);
