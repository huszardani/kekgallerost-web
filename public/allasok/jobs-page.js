const jobs = window.KG_JOBS || [];
const jobsPageGrid = document.querySelector("#jobsPageGrid");
const jobCount = document.querySelector("#jobCount");
const searchInput = document.querySelector("#searchInput");
const cityFilter = document.querySelector("#cityFilter");
const categoryFilter = document.querySelector("#categoryFilter");
const jobSearchForm = document.querySelector("#jobSearchForm");

function uniqueValues(key) {
  return [...new Set(jobs.map((job) => job[key]))].sort((a, b) => a.localeCompare(b, "hu"));
}

function fillSelect(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function jobMatches(job) {
  const query = searchInput.value.trim().toLowerCase();
  const selectedCity = cityFilter.value;
  const selectedCategory = categoryFilter.value;
  const haystack = [
    job.title,
    job.company,
    job.city,
    job.workLocation,
    job.category,
    job.salary,
    job.shift,
    job.transport,
    job.summary,
    ...job.highlights
  ].join(" ").toLowerCase();

  return (
    (!query || haystack.includes(query)) &&
    (!selectedCity || job.city === selectedCity) &&
    (!selectedCategory || job.category === selectedCategory)
  );
}

function renderJobs() {
  const filteredJobs = jobs.filter(jobMatches);
  jobsPageGrid.replaceChildren();

  filteredJobs.forEach((job) => {
    const card = document.createElement("a");
    card.className = "job-tile";
    card.href = encodeURIComponent(job.slug || job.id) + "/index.html";
    card.setAttribute("aria-label", `${job.title} részletei és jelentkezés`);
    card.innerHTML = `
      <div class="job-card-top">
        <span class="job-logo-pill" aria-label="Kékgallérost.hu"><img src="../assets/logo-mark.png" alt=""></span>
        <span class="pill salary-pill">${job.salary}</span>
      </div>
      <h3>${job.title}</h3>
      <p>${job.company}</p>
      <dl class="job-facts">
        <div><dt>Hely</dt><dd>${job.city}</dd></div>
        <div><dt>Műszak</dt><dd>${job.shift}</dd></div>
        <div><dt>Kezdés</dt><dd>${job.start}</dd></div>
        <div><dt>Bejárás</dt><dd>${job.transport}</dd></div>
      </dl>
      <ul class="job-highlights">
        <li>${job.experience}</li>
        <li>${job.highlights[0]}</li>
        <li>${job.highlights[1]}</li>
      </ul>
      <span class="button button-primary">Részletek és jelentkezés</span>
    `;
    jobsPageGrid.append(card);
  });

  jobCount.textContent = `${filteredJobs.length} aktív állás`;
}

fillSelect(cityFilter, uniqueValues("city"));
fillSelect(categoryFilter, uniqueValues("category"));
renderJobs();

jobSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  renderJobs();
});

[searchInput, cityFilter, categoryFilter].forEach((control) => {
  control.addEventListener("input", renderJobs);
});
