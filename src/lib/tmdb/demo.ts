import type { Filters } from "@/lib/filters";
import { poolExhausted } from "@/lib/tmdb/errors";
import { secureRng, type Rng } from "@/lib/tmdb/discover";
import type { Movie, RandomMovieResult } from "@/lib/tmdb/types";

interface DemoSeed {
  id: number;
  title: string;
  year: number;
  runtime: number;
  rating: number;
  votes: number;
  genres: number[];
  language: string;
  director: string;
  overview: string;
  tagline: string;
  poster: number;
}

const SEEDS: readonly DemoSeed[] = [
  {
    id: 900001,
    title: "The Last Projectionist",
    year: 2019,
    runtime: 112,
    rating: 7.8,
    votes: 1842,
    genres: [18],
    language: "en",
    director: "Mara Ellison",
    overview:
      "A small-town projectionist keeps a dying cinema alive for one final midnight screening, and finds the audience he never knew he had.",
    tagline: "Every reel ends. Every story doesn't.",
    poster: 1,
  },
  {
    id: 900002,
    title: "Neon Harvest",
    year: 2022,
    runtime: 128,
    rating: 7.4,
    votes: 5210,
    genres: [878, 53],
    language: "ja",
    director: "Kenji Arata",
    overview:
      "In a rain-soaked megacity, a courier smuggles the last living seed across a border of light and surveillance.",
    tagline: "Grow something worth stealing.",
    poster: 2,
  },
  {
    id: 900003,
    title: "A Quiet Cartography",
    year: 2016,
    runtime: 96,
    rating: 7.1,
    votes: 912,
    genres: [18, 10749],
    language: "fr",
    director: "Camille Roux",
    overview:
      "Two strangers map the same city in opposite directions and keep meeting at the exact centre of the page.",
    tagline: "Some distances are drawn to be crossed.",
    poster: 3,
  },
  {
    id: 900004,
    title: "Iron Orchard",
    year: 2024,
    runtime: 141,
    rating: 8.1,
    votes: 12840,
    genres: [28, 18],
    language: "ko",
    director: "Park Soo-jin",
    overview:
      "A retired enforcer returns to the family orchard and finds the roots of an old war still feeding on the soil.",
    tagline: "What you plant comes back for you.",
    poster: 4,
  },
  {
    id: 900005,
    title: "The Comedy of Small Hours",
    year: 1998,
    runtime: 103,
    rating: 7.6,
    votes: 3310,
    genres: [35, 10749],
    language: "en",
    director: "Leonard Voss",
    overview:
      "A night-shift radio host takes calls from insomniacs and accidentally arranges the love affair of the decade.",
    tagline: "Stay up. Fall in.",
    poster: 5,
  },
  {
    id: 900006,
    title: "Red Meridian",
    year: 1987,
    runtime: 118,
    rating: 7.9,
    votes: 2205,
    genres: [37, 12],
    language: "es",
    director: "Alma Quintero",
    overview:
      "A cartographer and a bandit cross a desert that refuses to appear on any map, chasing the same impossible horizon.",
    tagline: "The map ends here.",
    poster: 6,
  },
  {
    id: 900007,
    title: "Paper Lanterns, Long Night",
    year: 2011,
    runtime: 89,
    rating: 6.9,
    votes: 640,
    genres: [16, 14],
    language: "zh",
    director: "Lin Wei",
    overview:
      "A girl releases a paper lantern to find her brother and follows it through a city of sleeping spirits.",
    tagline: "Follow the light home.",
    poster: 1,
  },
  {
    id: 900008,
    title: "The Custodian",
    year: 2020,
    runtime: 109,
    rating: 7.2,
    votes: 1495,
    genres: [9648, 53],
    language: "de",
    director: "Hanna Kirsch",
    overview:
      "A museum cleaner notices that one painting changes every morning and begins to suspect the museum is hiding a witness.",
    tagline: "Someone has been cleaning up.",
    poster: 2,
  },
  {
    id: 900009,
    title: "Gravity Picnic",
    year: 2005,
    runtime: 94,
    rating: 7.3,
    votes: 2710,
    genres: [35, 878],
    language: "en",
    director: "Dale Mercer",
    overview:
      "Two rival physicists get stranded on a picnic planet where the laws of gravity are negotiable and the sandwiches are excellent.",
    tagline: "Lunch is relative.",
    poster: 3,
  },
  {
    id: 900010,
    title: "Salt & Static",
    year: 2023,
    runtime: 132,
    rating: 7.7,
    votes: 4380,
    genres: [18, 10402],
    language: "pt",
    director: "Bruna Alves",
    overview:
      "A faded radio singer and a teenage sound engineer record one last album in a lighthouse before the signal goes dark.",
    tagline: "One more take before the tide.",
    poster: 4,
  },
  {
    id: 900011,
    title: "The Wolf Hour",
    year: 1979,
    runtime: 121,
    rating: 8.0,
    votes: 3890,
    genres: [27, 53],
    language: "it",
    director: "Enzo Falco",
    overview:
      "A mountain village locks its doors at dusk, but the creature outside is not the one the elders warned them about.",
    tagline: "Do not answer the third knock.",
    poster: 5,
  },
  {
    id: 900012,
    title: "Borrowed Summer",
    year: 2014,
    runtime: 101,
    rating: 6.8,
    votes: 780,
    genres: [10749, 35],
    language: "en",
    director: "Nina Patel",
    overview:
      "A house-sitter falls for the neighbour of a family she has never met, and spends a summer pretending to be someone else.",
    tagline: "The house wasn't the only thing borrowed.",
    poster: 6,
  },
  {
    id: 900013,
    title: "Deep Field",
    year: 2021,
    runtime: 137,
    rating: 8.3,
    votes: 9520,
    genres: [99, 36],
    language: "en",
    director: "Owen Mbeki",
    overview:
      "The astronomers who pointed a telescope at nothing, and found everything, tell the story in their own words.",
    tagline: "Look long enough and the dark looks back.",
    poster: 1,
  },
  {
    id: 900014,
    title: "The Great Indoors",
    year: 1995,
    runtime: 87,
    rating: 6.6,
    votes: 410,
    genres: [10751, 35],
    language: "en",
    director: "Ruth Calloway",
    overview:
      "A family attempts to camp in their living room for a week and discovers that the wilderness was inside all along.",
    tagline: "Adventure starts at the sofa.",
    poster: 2,
  },
  {
    id: 900015,
    title: "Cobalt Road",
    year: 2018,
    runtime: 124,
    rating: 7.0,
    votes: 1880,
    genres: [80, 53],
    language: "en",
    director: "Marcus Grey",
    overview:
      "A getaway driver takes one last job and discovers the cargo is a witness who knows where his family is buried.",
    tagline: "No exits. No reverse.",
    poster: 3,
  },
  {
    id: 900016,
    title: "A Fire in the Archive",
    year: 2025,
    runtime: 147,
    rating: 8.4,
    votes: 11220,
    genres: [36, 18],
    language: "hi",
    director: "Anaya Rao",
    overview:
      "A young archivist risks a national collection to save the letters of a forgotten independence leader.",
    tagline: "Some records refuse to burn.",
    poster: 4,
  },
  {
    id: 900017,
    title: "Plaster Saints",
    year: 2009,
    runtime: 115,
    rating: 7.5,
    votes: 2260,
    genres: [18, 9648],
    language: "pl",
    director: "Tomasz Bielski",
    overview:
      "A restorer discovers a second painting beneath a church mural and a confession hidden in the pigment.",
    tagline: "Every layer tells on the one beneath.",
    poster: 5,
  },
  {
    id: 900018,
    title: "Sunset Machine",
    year: 2026,
    runtime: 106,
    rating: 7.2,
    votes: 530,
    genres: [878, 10749],
    language: "en",
    director: "Iris Chen",
    overview:
      "A programmer builds a machine that can replay any sunset, then meets someone who has never seen one.",
    tagline: "Some things are only real once.",
    poster: 6,
  },
  {
    id: 900019,
    title: "The Long Way Down the Mountain",
    year: 1984,
    runtime: 152,
    rating: 8.2,
    votes: 6020,
    genres: [12, 18],
    language: "ja",
    director: "Hideo Mori",
    overview:
      "Two brothers descend a sacred mountain with a failed harvest and a promise neither is willing to break.",
    tagline: "The mountain remembers who leaves.",
    poster: 1,
  },
  {
    id: 900020,
    title: "Night Bus to Anywhere",
    year: 2012,
    runtime: 98,
    rating: 6.5,
    votes: 350,
    genres: [18, 35],
    language: "es",
    director: "Rosa Delgado",
    overview:
      "Passengers on an overnight bus discover the driver has no destination and the road has no end.",
    tagline: "Tickets, please.",
    poster: 2,
  },
  {
    id: 900021,
    title: "Glass Aviary",
    year: 2002,
    runtime: 111,
    rating: 7.4,
    votes: 1990,
    genres: [16, 18],
    language: "fr",
    director: "Béatrice Lune",
    overview:
      "A boy made of glass inherits a house full of birds and must decide whether to open every window.",
    tagline: "Fragile things still fly.",
    poster: 3,
  },
  {
    id: 900022,
    title: "Low Tide, High Water",
    year: 1991,
    runtime: 133,
    rating: 7.7,
    votes: 3120,
    genres: [10752, 18],
    language: "de",
    director: "Klaus Reinhardt",
    overview:
      "A coastal village is ordered to evacuate during a forgotten war, and one family refuses to leave the lighthouse.",
    tagline: "The sea keeps its promises.",
    poster: 4,
  },
  {
    id: 900023,
    title: "Lightyear Ladies",
    year: 2020,
    runtime: 105,
    rating: 7.0,
    votes: 1670,
    genres: [28, 35],
    language: "en",
    director: "Sasha Bloom",
    overview:
      "Three retired stuntwomen reunite to steal a rocket from the studio that wrote them out of history.",
    tagline: "They did their own stunts. They'll do their own heist.",
    poster: 5,
  },
  {
    id: 900024,
    title: "The Quietest Room",
    year: 2017,
    runtime: 92,
    rating: 6.7,
    votes: 460,
    genres: [27, 9648],
    language: "en",
    director: "Joel Harrow",
    overview:
      "A sound engineer tests an anechoic chamber and starts hearing a recording that was never made.",
    tagline: "Silence is not empty.",
    poster: 6,
  },
];

function releaseDate(year: number): string {
  return `${year}-06-15`;
}

function demoMovie(seed: DemoSeed): Movie {
  return {
    id: seed.id,
    title: seed.title,
    originalTitle: seed.title,
    overview: seed.overview,
    tagline: seed.tagline,
    releaseDate: releaseDate(seed.year),
    releaseYear: seed.year,
    runtime: seed.runtime,
    voteAverage: seed.rating,
    voteCount: seed.votes,
    genres: seed.genres.map((id) => ({
      id,
      name:
        {
          12: "Adventure",
          14: "Fantasy",
          16: "Animation",
          18: "Drama",
          27: "Horror",
          28: "Action",
          35: "Comedy",
          36: "History",
          37: "Western",
          53: "Thriller",
          80: "Crime",
          99: "Documentary",
          878: "Science Fiction",
          9648: "Mystery",
          10402: "Music",
          10749: "Romance",
          10751: "Family",
          10752: "War",
        }[id] ?? "Movie",
    })),
    language: seed.language,
    director: seed.director,
    posterUrl: `/demo/poster-${seed.poster}.svg`,
    backdropUrl: `/demo/backdrop.svg`,
    tmdbUrl: "https://www.themoviedb.org/",
  };
}

const DEMO_MOVIES = SEEDS.map(demoMovie);

/**
 * Deterministic local dataset for UI tests and keyless demos. It is only
 * reachable when TMDB_DEMO_MODE is explicitly "true" and every response is
 * labelled `source: "demo"`.
 */
export function demoFindRandomMovie(
  filters: Filters,
  excludeIds: readonly number[] = [],
  rng: Rng = secureRng,
): RandomMovieResult {
  const excluded = new Set(excludeIds);
  const matches = DEMO_MOVIES.filter((movie) => {
    if (excluded.has(movie.id)) return false;
    if (movie.releaseYear === null) return false;
    if (movie.releaseYear < filters.yearFrom || movie.releaseYear > filters.yearTo) return false;
    if (movie.voteAverage < filters.minRating) return false;
    if (movie.voteCount < filters.minVotes) return false;
    if (movie.language !== filters.language && filters.language) return false;
    if (movie.runtime === null) return false;
    if (filters.runtimeMin !== null && movie.runtime < filters.runtimeMin) return false;
    if (filters.runtimeMax !== null && movie.runtime > filters.runtimeMax) return false;
    const movieGenres = new Set(movie.genres.map((genre) => genre.id));
    return filters.genres.every((id) => movieGenres.has(id));
  });

  if (matches.length === 0) {
    throw poolExhausted(
      "No unseen demo movies match these filters. Widen your filters or start a new session.",
      { totalResults: 0, excludedCount: excludeIds.length, reason: "demo_pool_exhausted" },
    );
  }

  const index = Math.min(matches.length - 1, Math.floor(rng() * matches.length));
  const movie = matches[index];
  return {
    movie,
    pool: {
      totalResults: matches.length,
      totalPages: 1,
      eligiblePages: 1,
      scannedPages: 1,
    },
    attempts: 1,
    source: "demo",
  };
}

export function demoMovieCount(): number {
  return DEMO_MOVIES.length;
}
