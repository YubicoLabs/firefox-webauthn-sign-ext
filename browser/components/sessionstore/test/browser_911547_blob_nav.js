document
  .getElementById("blob_nav_link")
  .addEventListener("click", function (e) {
    e.preventDefault();
    const html =
      "<!DOCTYPE html><html><body>" +
      '<input type="text" id="test_id2" value="id2_initial">' +
      "<script>document.getElementById('test_id2').value = 'id2_modified';<\/script>" +
      "</body></html>";
    const blob = new Blob([html], { type: "text/html" });
    location.href = URL.createObjectURL(blob);
  });
