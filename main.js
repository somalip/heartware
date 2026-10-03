fetch('README.md')
  .then(r => r.text())
  .then(md => {
    const temp = document.createElement('div');
    temp.innerHTML = marked.parse(md);
    const firstH1 = temp.querySelector('h1');
    const titleEl = document.getElementById('title');
    if (firstH1 && titleEl) {
      titleEl.textContent = firstH1.textContent;
      firstH1.remove();
    }
    document.getElementById('content').innerHTML = temp.innerHTML;
  })
  .catch(() => {
    document.getElementById('content').innerHTML = '<p>Could not load README.md</p>';
  });
