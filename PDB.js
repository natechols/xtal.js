
var max_bond_length = 1.99;

function Model (pdb_string) {
  this.atoms = [];
  this.connectivity = [];
  this.unit_cell = false;
  this.space_group = false;
  var lines = pdb_string.split("\n");
  for (var i = 0; i < lines.length; i++) {
    line = lines[i];
    var rec_type = line.substr(0,6);
    if (rec_type == "ATOM  " || rec_type == "HETATM") {
      var new_atom = new Atom(line);
      this.atoms.push(new_atom);
      this.connectivity.push([]);
    } else if (rec_type == "CRYST1") {
      var a = parseFloat(line.substr(6, 15));
      var b = parseFloat(line.substr(15, 24));
      var c = parseFloat(line.substr(24, 33));
      var alpha = parseFloat(line.substr(33, 40));
      var beta = parseFloat(line.substr(40, 47));
      var gamma = parseFloat(line.substr(47, 54));
      var sg_symbol = line.substr(55, 66);
      this.unit_cell = new UnitCell(a, b, c, alpha, beta, gamma);
    }
  }
  // O(n^2) loop, for testing purposes only
  // TODO replace with O(n) version ASAP
  for (var i = 0; i < this.atoms.length; i++) {
    for (var j = i+1; j < this.atoms.length; j++) {
      if (this.atoms[i].distance(this.atoms[j]) <= max_bond_length) {
        this.connectivity[i].push(j);
        this.connectivity[j].push(i);
      }
    }
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
  if (pdb_line) {
    if (pdb_line.length < 66) {
      throw Error("ATOM or HETATM record is too short: " + pdb_line);
    }
    var rec_type = line.substr(0, 6);
    if (rec_type == "HETATM") {
      this.hetero = true;
    } else if (rec_type != "ATOM  ") {
      throw Error("Wrong record type: " + rec_type);
    }
    this.name = pdb_line.substr(12,16);
    this.altloc = pdb_line.substr(16, 17).trim();
    this.resname = pdb_line.substr(17, 20).trim();
    this.chain = pdb_line.substr(20, 22).trim();
    this.resseq = pdb_line.substr(22, 26);
    this.icode = pdb_line.substr(26, 27).trim();
    var x = parseFloat(pdb_line.substr(30, 38));
    var y = parseFloat(pdb_line.substr(38, 46));
    var z = parseFloat(pdb_line.substr(46, 54));
    this.xyz = [ x, y, z ];
    this.occ = parseFloat(pdb_line.substr(54, 60));
    this.b = parseFloat(pdb_line.substr(60, 66));
    if (pdb_line.length >= 78) {
      this.element = pdb_line.substr(76, 78).trim();
    }
    if (pdb_line.length >= 80) {
      this.charge = pdb_line.substr(78, 80).trim();
    }
  }
  this.distance = function (other) {
    return distance(this.xyz, other.xyz);
  }
  this.midpoint = function (other) {
    return midpoint(this.xyz, other.xyz);
  }
}
