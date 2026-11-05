const https = require('https');
const fs = require('fs');

const token = process.env.GH_TOKEN;
const repo = 'jhonatanalex-lang/sistema-admision-web';

const options = {
  hostname: 'api.github.com',
  path: `/repos/${repo}/releases?per_page=15`,
  headers: {
    'User-Agent': 'GitHub-Actions-Release-Bumper',
    ...(token ? { 'Authorization': `token ${token}` } : {})
  }
};

https.get(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const releases = JSON.parse(data);
      let maxPatch = 43; // Baseline version

      if (Array.isArray(releases)) {
        releases.forEach(r => {
          const match = r.tag_name && r.tag_name.match(/v?1\.0\.(\d+)/);
          if (match) {
            const patchNum = parseInt(match[1], 10);
            if (patchNum > maxPatch) {
              maxPatch = patchNum;
            }
          }
        });
      }

      const nextVersion = `1.0.${maxPatch + 1}`;
      console.log(`[Version Bumper] Versión más reciente detectada en GitHub: 1.0.${maxPatch}`);
      console.log(`[Version Bumper] Nueva versión calculada: ${nextVersion}`);

      const pkgPath = fs.existsSync('package.json') ? 'package.json' : 'desktop/package.json';
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.version = nextVersion;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

      console.log(`[Version Bumper] ${pkgPath} actualizado exitosamente a v${nextVersion}`);
    } catch (err) {
      console.error('[Version Bumper] Error al calcular la nueva versión:', err);
      process.exit(1);
    }
  });
}).on('error', err => {
  console.error('[Version Bumper] Error de conexión con GitHub API:', err);
  process.exit(1);
});
