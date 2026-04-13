const fs = require('fs');
const script = `
<script>
(function() {
  const o = new MutationObserver(() => {
    document.querySelectorAll('button').forEach(btn => {
      if (btn.textContent.trim() === 'Archive' && (!btn.nextElementSibling || !btn.nextElementSibling.classList.contains('my-delete-btn'))) {
        const card = btn.closest('.rounded-xl');
        if(!card) return;
        const titleEl = card.querySelector('h3');
        if(!titleEl) return;
        const bName = titleEl.textContent.trim();
        
        const dBtn = document.createElement('button');
        dBtn.className = btn.className + ' my-delete-btn';
        dBtn.style.color = '#fff';
        dBtn.style.backgroundColor = '#ef4444';
        dBtn.style.borderColor = '#ef4444';
        dBtn.textContent = 'Delete';
        
        dBtn.onclick = () => {
          if(confirm('Are you sure you want to permanently delete batch: "' + bName + '"? This will erase all its records and cannot be undone.')) {
            let bArr = JSON.parse(localStorage.getItem('pm_batches') || '[]');
            const tgt = bArr.find(b => b.name === bName);
            if(tgt) {
              bArr = bArr.filter(b => b.id !== tgt.id);
              localStorage.setItem('pm_batches', JSON.stringify(bArr));
              ['pm_logs','pm_vaccines','pm_stock','pm_expenses'].forEach(k => {
                let items = JSON.parse(localStorage.getItem(k) || '[]');
                items = items.filter(i => i.batchId !== tgt.id);
                localStorage.setItem(k, JSON.stringify(items));
              });
              let aid = localStorage.getItem('pm_activeId') || '';
              if(aid.includes(tgt.id)) {
                localStorage.removeItem('pm_activeId');
              }
              window.location.reload();
            } else {
              alert('Batch not found in storage.');
            }
          }
        };
        btn.parentNode.appendChild(dBtn);
      }
    });
  });
  o.observe(document.body, { childList: true, subtree: true });
})();
</script>
`;

['c:/Users/USER/Downloads/Poultry/BXN_Poultry_Manager.html', 'c:/Users/USER/Downloads/Poultry/OfflineWeb/index.html'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('my-delete-btn')) {
    if (content.endsWith('</body></html>')) {
      content = content.replace('</body></html>', script + '</body></html>');
    } else {
      content += script;
    }
    fs.writeFileSync(file, content, 'utf8');
  }
});
console.log('Update Complete!');
