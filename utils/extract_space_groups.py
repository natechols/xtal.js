
from cctbx import sgtbx
import json

def run () :
  groups = []
  lookup_dict = {}
  for i_sg in range(1, 231) :
    space_group_info = sgtbx.space_group_info(number=i_sg)
    space_group = space_group_info.group()
    group = { "symbol" : str(space_group_info),
              "number" : i_sg,
              "operators" : [] }
    for mx in space_group.smx() :
      group["operators"].append(str(mx))
    groups.append(group)
  for symbol in sgtbx.space_group_symbol_iterator() :
    lookup_dict[str(symbol.hermann_mauguin())] = symbol.number()
    lookup_dict[str(symbol.hall())] = symbol.number()
  print json.dumps({"groups" : groups, "lookup" : lookup_dict })

if (__name__ == "__main__") :
  run()
