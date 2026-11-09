const fs = require('node:fs');
const path = require('node:path');
function withUploadLimits(config) {
  if (config.includes('# CAREOPS_UPLOAD_ROUTES')) return config;
  const block = /^([ \t]*)location \/ \{([\s\S]*?)^\1\}/m.exec(config);
  if (!block || !block[2].includes('proxy_pass ') || !block[2].includes('X-CareOps-Edge-Key')) throw new Error('Expected trusted gateway proxy configuration');
  const [original, indent, body] = block;
  const imports = `${indent}# CAREOPS_UPLOAD_ROUTES\n${indent}location ~ ^/api/users/import/(preview|commit)$ {\n${indent}  client_max_body_size 3m;${body}${indent}}\n`;
  const evidence = `${indent}location ~ ^/api/tasks/[1-9][0-9]*/attachments$ {\n${indent}  client_max_body_size 6m;${body}${indent}}\n`;
  return config.replace(original, imports + evidence + original);
}
if (require.main === module) {
  const directory = path.resolve(__dirname, '../deploy/.runtime');
  const file = path.join(directory, 'nginx.conf');
  const before = fs.readFileSync(file, 'utf8');
  const after = withUploadLimits(before);
  if (process.argv.includes('--apply') && after !== before) {
    fs.writeFileSync(path.join(directory, 'nginx-before-uploads-' + Date.now() + '.conf'), before, {flag:'wx',mode:0o600});
    fs.writeFileSync(file, after);
  }
  console.log(JSON.stringify({ready:after===before || process.argv.includes('--apply'),changed:after!==before && process.argv.includes('--apply'),normalRequestLimit:'64k',importGatewayLimit:'3m',evidenceGatewayLimit:'6m'}));
}
module.exports = {withUploadLimits};
