/*

xtal.js PDB & CIF models.

Exports:
	Atom
	Model
	Cubicle

*/
var xtal = (function(module) {return module})(xtal||{});
xtal.model = (function(module) {

var max_bond_length = 1.99;
var max_bond_length_SP = 2.2;
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

function Model (pdb_string) {
  this.atoms = [];
  this.chain_indices = [];
  this.unit_cell = null;
  this.space_group = null;
  this.has_hydrogens = false;
  this.ligand_flags = null;
  
  // Initialize from mmCIF model
  this.from_mmcif = function(cif_block) {
    var chain_index = 0;
    var last_chain = null;
		var atoms = cif_block.loop_dict('_atom_site');
		for (var i=0;i<atoms.length;i++) {
      var atom = new Atom();
      atom.from_mmcif(atoms[i]);
      // Setup atom...
      this.atoms.push(atom);
      // Update the chain.
      if (atom.chain != last_chain) {
        chain_index++;
      }
      this.chain_indices.push(chain_index);
      last_chain = atom.chain;
    }
    // Update connectivity.
    if (this.atoms.length == 0) {
      throw Error("No atom records found.")
    }
    this.connectivity = get_connectivity_fast(this.atoms);
  }
	
  // Initialize from mmCIF model
  this.from_monlib = function(cif_block) {
    var chain_index = 0;
    var last_chain = null;
		var atoms = cif_block.loop_dict('_chem_comp_atom');
		for (var i=0;i<atoms.length;i++) {
      var atom = new Atom();
			atom.from_monlib(atoms[i]);
      // Setup atom...
      this.atoms.push(atom);
      // Update the chain.
      if (atom.chain != last_chain) {
        chain_index++;
      }
      this.chain_indices.push(chain_index);
      last_chain = atom.chain;
    }
    // Update connectivity.
    if (this.atoms.length == 0) {
      throw Error("No atom records found.")
    }
    this.connectivity = get_connectivity_fast(this.atoms);
  }

  // Initialize from PDB string
  this.from_pdb = function(pdb_string) {
    console.log("from_pdb");
    var lines = pdb_string.split("\n");
    var chain_index = 0;
    var last_chain = null;
  
    for (var i = 0; i < lines.length; i++) {
      line = lines[i];
      var rec_type = line.substring(0,6);
      if (rec_type == "ATOM  " || rec_type == "HETATM") {
        var new_atom = new Atom() 
        new_atom.from_pdb_line(line);
        
        this.atoms.push(new_atom);
        if ((! this.has_hydrogens) && (new_atom.element == "H")) {
          this.has_hydrogens = true;
        }
        if (new_atom.chain != last_chain) {
          chain_index++;
        }
        this.chain_indices.push(chain_index);
        last_chain = new_atom.chain;
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
    if (this.atoms.length == 0) {
      throw Error("No atom records found.")
    }

    //this.connectivity = get_connectivity_simple(this.atoms);
    this.connectivity = get_connectivity_fast(this.atoms);
  }
  
  this.extract_trace = function () {
    return extract_trace(this);
  }
  this.extract_ligands = function () {
    if (this.ligand_flags == null) {
      this.ligand_flags = [];
      for (var i = 0; i < this.atoms.length; i++) {
        var atom = this.atoms[i];
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
  this.extract_interesting_residues = function () {
    return extract_interesting_residues(this);
  }
  this.update_atoms = function (other) {
    this.atoms = other.atoms;
    this.chain_indices = other.chain_indices;
    this.connectivity = other.connectivity;
    this.has_hydrogens = other.has_hydrogens;
    this.ligand_flags = null;
    return this;
  }
  this.get_center_and_size = function () {
    var xsum = 0, ysum = 0, zsum = 0, n_atoms = this.atoms.length;
    var xmax = -99999, xmin = 99999;
    var ymax = -99999, ymin = 99999;
    var zmax = -99999, zmin = 99999;
    for (var i = 0; i < n_atoms; i++) {
      var x = this.atoms[i].xyz[0], y = this.atoms[i].xyz[1],
          z = this.atoms[i].xyz[2];
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

// 13 - 16  Atom          name          Atom name.
// 17       Character     altLoc        Alternate location indicator.
// 31 - 38  Real(8.3)     x             Orthogonal coordinates for X in
//                                      Angstroms.
// 39 - 46  Real(8.3)     y             Orthogonal coordinates for Y in
//                                      Angstroms.
// 47 - 54  Real(8.3)     z             Orthogonal coordinates for Z in
//                                      Angstroms.
// 55 - 60  Real(6.2)     occupancy     Occupancy.
// 61 - 66  Real(6.2)     tempFactor    Temperature factor.
// 73 - 76  LString(4)    segID         Segment identifier, left-justified.
// 77 - 78  LString(2)    element       Element symbol, right-justified.
// 79 - 80  LString(2)    charge        Charge on the atom.
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
  this.element = "";
  this.charge = 0;
  this.i_seq = "";
  
  this.from_mmcif = function(m) {
    if (m['group_pdb'] == "HETATM") {
      this.hetero = true;
    }
    this.name = m['label_atom_id'];
    this.altloc = m['label_alt_id'];
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
    this.xyz = [x, y, z];
    this.element = m['type_symbol'];
    this.charge = m['partial_charge'];
	}
	
  // From PDB Line.
  this.from_pdb_line = function(pdb_line) {
    if (pdb_line.length < 66) {
      throw Error("ATOM or HETATM record is too short: " + pdb_line);
    }
    var rec_type = line.substring(0, 6);
    if (rec_type == "HETATM") {
      this.hetero = true;
    } else if (rec_type != "ATOM  ") {
      throw Error("Wrong record type: " + rec_type);
    }
    this.name = pdb_line.substring(12,16);
    this.altloc = pdb_line.substring(16, 17).trim();
    this.resname = pdb_line.substring(17, 20).trim();
    this.chain = pdb_line.substring(20, 22).trim();
    this.resseq = pdb_line.substring(22, 26);
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
  this.is_bonded_to = function (other) {
    if (! this.is_same_conformer(other)) return false;
    var dxyz = this.distance(other);
    if (dxyz <= max_bond_length) {
      return true;
    } else if (dxyz < max_bond_length_SP) {
      if (this.is_s_or_p() || other.is_s_or_p()) {
        return true;
      }
    }
    return false;
  }
}

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

function extract_trace (model) {
  var segments = [];
  var current_segment = [];
  var last_chain_index = null;
  var last_atom_index = null;
  for (var i = 0; i < model.atoms.length; i++) {
    var atom = model.atoms[i];
    var chain_index = model.chain_indices[i];
    var start_new = false;
    if ((atom.altloc != "") && (atom.altloc != "A")) continue;
    if ((atom.name == " CA ") || (atom.name == " P  ")) {
      if ((last_atom_index != null) && (last_chain_index == chain_index)) {
        var dxyz = atom.distance(model.atoms[last_atom_index]);
        if (((atom.name == " CA ") && (dxyz <= 5.5)) ||
            ((atom.name == " P  ") && (dxyz < 7.5))) {
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
  for (var i = 0; i < model.atoms.length; i++) {
    var atom = model.atoms[i];
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

// Exports into xtal.model
return {
	'Model': Model,
	'Atom': Atom,
	'Cubicles': Cubicles
}
})(xtal);
