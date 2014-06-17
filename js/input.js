Dropzone.options.phenixDropzone = {
  //maxFilesize: 200, 
  //maxThumbnailFilesize: 10,
  success: function(file, response){
    console.log(response);
    var updates = jQuery.parseJSON(response);
    if (updates.file_name) {
      var form = $("#run_app");
      var input = $("<input/>").attr("type", "hidden").attr("name",
        "file_name").val(updates.file_name);
      form.append(input);
      $("#run_app_button").unbind("click");
      $("#run_app_button").click(function(e) {
        e.preventDefault();
        run_app();
        return true;
      });
    }
    if (updates.space_group) {
      $("#space_group").val(updates.space_group);
    }
    if (updates.unit_cell) {
      $("#unit_cell").val(updates.unit_cell);
    }
    if (updates.d_min) {
      $("#d_min").val(updates.d_min);
    }
    if (updates.d_max) {
      $("#d_max").val(updates.d_max);
    }
    if (updates.data_labels) {
      var labels_ctrl = $("#data_labels");
      labels_ctrl.empty();
      for (var i_label = 0; i_label < updates.data_labels.length; i_label++) {
        labels_ctrl.append($("<option/>").val(
          updates.data_labels[i_label]).text(updates.data_labels[i_label]));
      }
    }
  }
};

function run_app () {
  $("#run_app").submit(); 
}
