const fs = require('fs-extra');
const path = require('path');

const srcDir = path.join(__dirname, 'src/controllers/homeKey/fonts');
const destDir = path.join(__dirname, 'build/controllers/homeKey/fonts');

fs.copy(srcDir, destDir, err => {
    if (err) {
        return console.error('Error copying fonts:', err);
    }
    console.log('Fonts copied successfully!');
});
