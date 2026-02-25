function calculateAverage(users) {
  const votes = users.map((u) => parseInt(u.vote)).filter((v) => !isNaN(v));

  if (votes.length === 0) return 0;
  const sum = votes.reduce((a, b) => a + b, 0);
  return (sum / votes.length).toFixed(1);
}
