// Test helper: hydrate production external scripts in browser load order for
// existing source-level regression tests. This is never shipped to browsers.
const fs = require('node:fs');
const path = require('node:path');
module.exports = function readToolkitSource(){
  const root = path.resolve(__dirname,'..');
  return fs.readFileSync(path.join(root,'index.html'),'utf8').replace(
    /<script src="(js\/[^"]+\.js)"><\/script>/g,
    (_,filename)=>'<script>'+fs.readFileSync(path.join(root,filename),'utf8')+'</script>'
  );
};
