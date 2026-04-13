const fs=require('fs'); 
const c=fs.readFileSync('c:/Users/USER/Downloads/Poultry/BXN_Poultry_Manager.html','utf8'); 
console.log(c.match(/ob\([^)]*\)/g));
