/**
 * Tournament Bracket System
 * 
 * This file contains the core functionality for generating and managing tournament brackets.
 * It's designed to be modular and support different tournament layouts.
 */

// Configuration object to store tournament settings
const TournamentConfig = {
  // Default configuration
  defaultConfig: {
    type: 'single-elimination',
    playerCount: 8,
    playerNames: [],
    roundNames: {
      finals: 'Finals',
      semiFinals: 'Semi-Finals',
      quarterFinals: 'Quarter-Finals',
      default: 'Round'
    }
  },

  // Tournament type configurations
  tournamentTypes: {
    'single-elimination': {
      name: 'Single Elimination',
      description: 'Players are eliminated after a single loss',
      generator: 'generateSingleEliminationBracket'
    },
    // Add more tournament types here as they are implemented
    // Example:
    // 'double-elimination': {
    //   name: 'Double Elimination',
    //   description: 'Players are eliminated after two losses',
    //   generator: 'generateDoubleEliminationBracket'
    // },
    // 'round-robin': {
    //   name: 'Round Robin',
    //   description: 'Each player plays against every other player',
    //   generator: 'generateRoundRobinBracket'
    // }
  },

  // Current configuration (initialized with defaults)
  current: null,

  // Initialize configuration from URL parameters or defaults
  initialize: function() {
    this.current = { ...this.defaultConfig };

    // Get the tournament type from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type');

    // Set tournament type if valid
    if (typeParam && this.tournamentTypes[typeParam]) {
      this.current.type = typeParam;
    }

    // Get the players from the URL query parameter
    const playersParam = urlParams.get('players') || '8';

    // Check if the players parameter is a number or a comma-separated list
    if (playersParam.includes(',')) {
      // It's a comma-separated list of player names
      this.current.playerNames = playersParam.split(',');
      this.current.playerCount = this.current.playerNames.length;
    } else {
      // It's a number
      this.current.playerCount = parseInt(playersParam) || 8;
      // Create default player names (Player 1, Player 2, etc.)
      this.current.playerNames = [];
      for (let i = 1; i <= this.current.playerCount; i++) {
        this.current.playerNames.push(`Player ${i}`);
      }
    }

    // Ensure the number of players is at least 2
    this.current.playerCount = Math.max(2, this.current.playerCount);
    if (this.current.playerNames.length < this.current.playerCount) {
      // Add more default player names if needed
      for (let i = this.current.playerNames.length + 1; i <= this.current.playerCount; i++) {
        this.current.playerNames.push(`Player ${i}`);
      }
    } else if (this.current.playerNames.length > this.current.playerCount) {
      // Trim the player names array if needed
      this.current.playerNames = this.current.playerNames.slice(0, this.current.playerCount);
    }

    return this.current;
  },

  // Get available tournament types
  getAvailableTypes: function() {
    return Object.keys(this.tournamentTypes).map(key => ({
      id: key,
      ...this.tournamentTypes[key]
    }));
  }
};

// Utility functions
const TournamentUtils = {
  // Function to get the next power of 2 greater than or equal to n
  getNextPowerOfTwo: function(n) {
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    return power;
  },

  // Get round name based on round number and total rounds
  getRoundName: function(round, numRounds, config) {
    if (round === numRounds - 2) {
      return config.roundNames.finals;
    } else if (round === numRounds - 3) {
      return config.roundNames.semiFinals;
    } else if (round === numRounds - 4) {
      return config.roundNames.quarterFinals;
    } else {
      return `${config.roundNames.default} ${round + 1}`;
    }
  }
};

// DOM manipulation functions
const TournamentDOM = {
  // Create a curved connector between two elements
  createCurvedConnector: function(sourceElement, targetElement, container, isUpperConnection) {
    // Create SVG element for the curved connector
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "connector-curved");
    svg.style.position = "absolute";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100%";
    svg.style.height = "100%";

    // Create path element
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    // Get positions relative to the container
    const sourceRect = sourceElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate start and end points
    const startX = sourceRect.right - containerRect.left;
    const startY = sourceRect.top + sourceRect.height / 2 - containerRect.top;
    const endX = targetRect.left - containerRect.left;

    // Adjust the end Y position based on whether this is an upper or lower connection
    const playerSlotHeight = targetRect.height / 2; // Height of a single player slot
    const endY = isUpperConnection
      ? targetRect.top + playerSlotHeight / 2 - containerRect.top // Upper connection
      : targetRect.top + targetRect.height - playerSlotHeight / 2 - containerRect.top; // Lower connection

    // Calculate control points for the curve
    const controlX = startX + (endX - startX) / 2;

    // Create the path data for a cubic bezier curve
    const pathData = `M ${startX},${startY} C ${controlX},${startY} ${controlX},${endY} ${endX},${endY}`;

    path.setAttribute("d", pathData);
    svg.appendChild(path);

    return svg;
  },

  // Update column name positions when zooming or panning
  updateColumnNamePositions: function() {
    const columns = document.querySelectorAll('.bracket-column');
    const columnNames = document.querySelectorAll('.column-name');

    columns.forEach((column, index) => {
      const columnRect = column.getBoundingClientRect();
      const centerX = columnRect.left + columnRect.width / 2;
      columnNames[index].style.left = `${centerX}px`;
    });
  }
};

// Event handlers for tournament interaction
const TournamentEvents = {
  // Function to handle player click and toggle winner status
  handlePlayerClick: function(event) {
    const player = event.currentTarget;
    const match = player.closest('.match');

    // Don't allow clicking in the champion round (last round)
    const round = parseInt(match.dataset.round);
    const matchIndex = parseInt(match.dataset.match);
    const nextRound = round + 1;
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextMatch = document.querySelector(`.match[data-round="${nextRound}"][data-match="${nextMatchIndex}"]`);

    // If there's no next match or this is the champion round (has a trophy), don't allow toggling
    if (!nextMatch || match.querySelector('.winner-trophy')) {
      return;
    }

    // Toggle winner status for the clicked player
    const isWinner = player.classList.toggle('winner');

    // If this player is now a winner, remove winner class from any sibling
    if (isWinner) {
      const siblings = match.querySelectorAll('.player');
      siblings.forEach(sibling => {
        if (sibling !== player && sibling.classList.contains('winner')) {
          sibling.classList.remove('winner');
        }
      });

      // Update the next match with this player's name
      this.updateNextMatch(match, player);
    } else {
      // If no winner is selected, clear the next match slot
      this.clearNextMatchSlot(match);
    }
  },

  // Function to update the next match with the winner's name
  updateNextMatch: function(match, winnerPlayer) {
    const round = parseInt(match.dataset.round);
    const matchIndex = parseInt(match.dataset.match);
    const nextRound = round + 1;
    const nextMatchIndex = Math.floor(matchIndex / 2);

    // Find the next match element
    const nextMatch = document.querySelector(`.match[data-round="${nextRound}"][data-match="${nextMatchIndex}"]`);
    if (!nextMatch) return;

    // Determine if this is the upper or lower player in the next match
    const isUpper = matchIndex % 2 === 0;
    const playerIndex = isUpper ? 0 : 1;

    // Get the player elements in the next match
    const nextMatchPlayers = nextMatch.querySelectorAll('.player');
    if (nextMatchPlayers.length <= playerIndex) return;

    // Update the player text in the next match
    const playerName = winnerPlayer.textContent;
    nextMatchPlayers[playerIndex].textContent = playerName;

    // Check if the player in the next match is already marked as a winner
    // If so, we need to propagate this change up the bracket
    if (nextMatchPlayers[playerIndex].classList.contains('winner')) {
      // Recursively update the next match up the bracket
      this.updateNextMatch(nextMatch, nextMatchPlayers[playerIndex]);
    }

    // Check if all matches in this round have winners
    this.checkRoundCompletion(round);
  },

  // Function to check if all matches in a round have winners and update the check mark
  checkRoundCompletion: function(round) {
    // Get all matches in this round
    const matches = document.querySelectorAll(`.match[data-round="${round}"]`);
    let allCompleted = true;

    // Check if each match has a winner
    matches.forEach(match => {
      const winners = match.querySelectorAll('.player.winner');
      if (winners.length === 0) {
        allCompleted = false;
      }
    });

    // Update the check mark visibility
    const columnName = document.querySelector(`.column-name[data-round="${round}"]`);
    if (columnName) {
      const checkMark = columnName.querySelector('.check-mark');
      if (checkMark) {
        if (allCompleted) {
          checkMark.classList.add('visible');
        } else {
          checkMark.classList.remove('visible');
        }
      }
    }
  },

  // Function to clear the next match slot when no winner is selected
  clearNextMatchSlot: function(match) {
    const round = parseInt(match.dataset.round);
    const matchIndex = parseInt(match.dataset.match);
    const nextRound = round + 1;
    const nextMatchIndex = Math.floor(matchIndex / 2);

    // Find the next match element
    const nextMatch = document.querySelector(`.match[data-round="${nextRound}"][data-match="${nextMatchIndex}"]`);
    if (!nextMatch) return;

    // Determine if this is the upper or lower player in the next match
    const isUpper = matchIndex % 2 === 0;
    const playerIndex = isUpper ? 0 : 1;

    // Get the player elements in the next match
    const nextMatchPlayers = nextMatch.querySelectorAll('.player');
    if (nextMatchPlayers.length <= playerIndex) return;

    // Check if the player in the next match is already marked as a winner
    // If so, we need to clear all matches up the bracket
    const wasWinner = nextMatchPlayers[playerIndex].classList.contains('winner');

    // Check if all matches in this round have winners (will update to false)
    this.checkRoundCompletion(round);

    // Check if the next match is the champion round (last round)
    const nextRoundNum = parseInt(nextMatch.dataset.round);
    const numRounds = document.querySelectorAll('.bracket-column').length;
    const isChampionRound = nextRoundNum === numRounds - 1;

    if (isChampionRound) {
      // If this is the champion round, restore the "Champion" placeholder with trophy
      nextMatchPlayers[playerIndex].innerHTML = `Champion <span class="winner-trophy">🏆</span>`;
    } else {
      // Otherwise, reset the player text in the next match to the default with specific round name
      const sourceMatchNum = parseInt(match.querySelector('.match-number').textContent.replace('Match ', ''));
      const sourceRound = parseInt(match.dataset.round);

      // Get the round name for more specific winner text
      let roundName;
      const numRounds = document.querySelectorAll('.bracket-column').length;
      if (sourceRound === numRounds - 2) {
        roundName = "Finals";
      } else if (sourceRound === numRounds - 3) {
        roundName = "Semi-Finals";
      } else {
        roundName = `Round ${sourceRound + 1}`;
      }

      nextMatchPlayers[playerIndex].textContent = `Winner of ${roundName} Match ${sourceMatchNum}`;

      // If this player was a winner, we need to recursively clear the next match as well
      if (wasWinner) {
        // Remove the winner class first to prevent infinite recursion
        nextMatchPlayers[playerIndex].classList.remove('winner');
        // Then recursively clear the next match
        this.clearNextMatchSlot(nextMatch);
      }
    }
  }
};

// Tournament generator for different layouts
const TournamentGenerator = {
  // Function to generate a single elimination tournament bracket
  generateSingleEliminationBracket: function(config) {
    const container = document.getElementById('tournament-container');
    container.innerHTML = '';

    const numPlayers = config.playerCount;
    const playerNames = config.playerNames;

    // Calculate the number of rounds needed based on the ceiling of log2
    // Add 1 to include the champion round
    const numRounds = Math.ceil(Math.log2(numPlayers)) + 1;

    // Store match elements for each round to create connectors later
    const matchesByRound = [];

    // Store the match sources to track which matches feed into which
    const matchSources = {};

    // Calculate the number of players that get a "bye" in the first round
    const totalMatchesNeeded = numPlayers - 1; // Total matches needed for a tournament
    // Subtract 1 from numRounds to account for the champion round
    const firstRoundMatches = Math.max(0, numPlayers - Math.pow(2, numRounds - 2)); // Matches in the first round
    const byeCount = Math.pow(2, numRounds - 1) - numPlayers; // Number of players that get a bye

    // Generate each round
    for (let round = 0; round < numRounds; round++) {
      const column = document.createElement('div');
      column.className = 'bracket-column';
      column.dataset.round = round;

      // Add column name (skip for the champion column)
      if (round !== numRounds - 1) {
        let columnName = TournamentUtils.getRoundName(round, numRounds, config);

        // Create column name element
        const columnNameElement = document.createElement('div');
        columnNameElement.className = 'column-name';
        columnNameElement.innerHTML = columnName + ' <span class="check-mark">✓</span>';
        columnNameElement.dataset.round = round;
      }

      // Calculate the number of matches in this round
      let numMatches;
      if (round === 0) {
        // First round has matches for players without byes
        numMatches = firstRoundMatches;
      } else if (round === numRounds - 1 || round === numRounds - 2) {
        // Finals and Champion rounds always have 1 match
        numMatches = 1;
      } else {
        // Intermediate rounds
        // Calculate how many matches we need in this round based on the previous round
        // and the number of players with byes that enter in this round
        if (round === 1 && firstRoundMatches === 0) {
          // Special case: if there are no first round matches (power of 2),
          // then the second round has numPlayers/2 matches
          numMatches = numPlayers / 2;
        } else if (round === 1) {
          // Second round combines winners from first round and players with byes
          numMatches = Math.ceil(firstRoundMatches / 2) + Math.floor(byeCount / 2);
        } else {
          // Later rounds just have half as many matches as the previous round
          numMatches = Math.ceil(matchesByRound[round-1].length / 2);
        }
      }

      // Calculate the minimum height needed based on the number of matches in the first round
      // Each match needs at least 80px of vertical space (2 players + margins)
      // We convert this to vh units for consistent sizing
      const minHeightPerMatch = 10; // in vh units

      // Calculate the total height needed for the first round
      // We use the maximum of the default height (40vh) and the calculated height
      const calculatedTotalHeight = firstRoundMatches > 0
        ? Math.max(40, firstRoundMatches * minHeightPerMatch)
        : 40; // Default to 40vh for power-of-two tournaments

      // Set the height of the column
      column.style.height = `${calculatedTotalHeight}vh`;

      // Use the same totalHeight for positioning calculations
      const totalHeight = calculatedTotalHeight;

      // Store matches for this round
      matchesByRound[round] = [];

      // Generate the matches for this round
      for (let match = 0; match < numMatches; match++) {
        const matchElement = document.createElement('div');
        matchElement.className = 'match';
        matchElement.dataset.round = round;
        matchElement.dataset.match = match;

        // Position matches using absolute positioning
        // Calculate the total slots in the final round (always power of 2)
        // Subtract 1 from numRounds to account for the champion round
        const finalRoundSlots = Math.pow(2, numRounds - 2);

        // For the first round with non-power-of-two players
        if (round === 0) {
          // Calculate the position based on match index, accounting for byes
          const positionPercentage = ((match + 0.5) / (firstRoundMatches > 0 ? firstRoundMatches : 1)) * totalHeight;

          // Set absolute positioning
          matchElement.style.position = 'absolute';
          matchElement.style.top = positionPercentage + 'vh';
        } else {
          // For later rounds, position matches to align with their predecessors
          // Calculate the position of this match in the binary tree
          const matchPosition = match + 0.5;

          // Calculate the percentage of the total height
          const positionPercentage = (matchPosition / (numMatches > 0 ? numMatches : 1)) * totalHeight;

          // Set absolute positioning for precise pyramid alignment
          matchElement.style.position = 'absolute';
          matchElement.style.top = positionPercentage + 'vh';
        }

        // Add match number
        const matchNumber = document.createElement('div');
        matchNumber.className = 'match-number';

        // Calculate match number based on round and match index
        let matchNumberValue;
        if (round === 0) {
          matchNumberValue = match + 1;
        } else {
          // For later rounds, calculate based on previous rounds
          let previousRoundsMatches = 0;
          for (let r = 0; r < round; r++) {
            previousRoundsMatches += matchesByRound[r].length;
          }
          matchNumberValue = previousRoundsMatches + match + 1;
        }

        matchNumber.textContent = `Match ${matchNumberValue}`;
        matchElement.appendChild(matchNumber);

        // Create a unique ID for this match
        const matchId = `r${round}m${match}`;
        matchElement.dataset.matchId = matchId;

        if (round === 0) {
          // First round - create player pairings
          const player1 = document.createElement('div');
          player1.className = 'player';
          player1.textContent = playerNames[match * 2] || `Player ${match * 2 + 1}`;
          player1.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));

          const player2 = document.createElement('div');
          player2.className = 'player';
          player2.textContent = playerNames[match * 2 + 1] || `Player ${match * 2 + 2}`;
          player2.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));

          matchElement.appendChild(player1);
          matchElement.appendChild(player2);

          // Track which match in the next round this match feeds into
          let nextRoundMatch;

          if (round === 0 && firstRoundMatches < numPlayers / 2) {
            // For the first round in non-power-of-two tournaments,
            // we need to calculate which match in the next round this feeds into
            nextRoundMatch = Math.floor(match / 2);
          } else {
            // Standard pairing
            nextRoundMatch = Math.floor(match / 2);
          }

          const nextMatchId = `r${round + 1}m${nextRoundMatch}`;

          if (!matchSources[nextMatchId]) {
            matchSources[nextMatchId] = [];
          }
          matchSources[nextMatchId].push({
            matchId,
            isUpper: match % 2 === 0
          });

        } else if (round === numRounds - 1) {
          // Champion round - show the winner
          const winner = document.createElement('div');
          winner.className = 'player winner';
          winner.innerHTML = `Champion <span class="winner-trophy">🏆</span>`;
          matchElement.appendChild(winner);
        } else {
          // Intermediate rounds
          // For non-power-of-two tournaments, we need to handle players with byes

          // Get the sources for this match
          const sources = matchSources[matchId] || [];

          // If we have fewer than 2 sources, some players had byes
          if (sources.length < 2) {
            // First player might be from a previous match or have a bye
            if (sources.length > 0 && sources[0].isUpper) {
              // Player from previous match
              const player1 = document.createElement('div');
              player1.className = 'player';
              const sourceMatchNum = parseInt(sources[0].matchId.substring(sources[0].matchId.indexOf('m') + 1)) + 1;
              const sourceRound = parseInt(sources[0].matchId.substring(1, sources[0].matchId.indexOf('m')));

              // Get the round name for more specific winner text
              let roundName = TournamentUtils.getRoundName(sourceRound, numRounds, config);

              player1.textContent = `Winner of ${roundName} Match ${sourceMatchNum}`;
              player1.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));
              matchElement.appendChild(player1);
            } else {
              // Player with a bye
              const player1 = document.createElement('div');
              player1.className = 'player';
              // Calculate player number based on round and match
              // For the first round with byes, we need to assign player numbers correctly
              // Players with byes start at firstRoundMatches*2+1
              const playerNum = firstRoundMatches * 2 + 1 + (match * 2);
              player1.textContent = playerNames[playerNum - 1] || `Player ${playerNum}`;
              player1.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));
              matchElement.appendChild(player1);
            }

            // Second player might be from a previous match or have a bye
            if (sources.length > 0 && !sources[0].isUpper) {
              // Player from previous match
              const player2 = document.createElement('div');
              player2.className = 'player';
              const sourceMatchNum = parseInt(sources[0].matchId.substring(sources[0].matchId.indexOf('m') + 1)) + 1;
              const sourceRound = parseInt(sources[0].matchId.substring(1, sources[0].matchId.indexOf('m')));

              // Get the round name for more specific winner text
              let roundName = TournamentUtils.getRoundName(sourceRound, numRounds, config);

              player2.textContent = `Winner of ${roundName} Match ${sourceMatchNum}`;
              player2.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));
              matchElement.appendChild(player2);
            } else {
              // Player with a bye
              const player2 = document.createElement('div');
              player2.className = 'player';
              // Calculate player number based on round and match
              // For the first round with byes, we need to assign player numbers correctly
              // Players with byes start at firstRoundMatches*2+1
              const playerNum = firstRoundMatches * 2 + 1 + (match * 2 + 1);
              player2.textContent = playerNames[playerNum - 1] || `Player ${playerNum}`;
              player2.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));
              matchElement.appendChild(player2);
            }
          } else {
            // Normal case - both players from previous matches
            const player1 = document.createElement('div');
            player1.className = 'player';
            const sourceMatchNum1 = parseInt(sources[0].matchId.substring(sources[0].matchId.indexOf('m') + 1)) + 1;
            const sourceRound1 = parseInt(sources[0].matchId.substring(1, sources[0].matchId.indexOf('m')));

            // Get the round name for more specific winner text
            let roundName1 = TournamentUtils.getRoundName(sourceRound1, numRounds, config);

            player1.textContent = `Winner of ${roundName1} Match ${sourceMatchNum1}`;
            player1.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));

            const player2 = document.createElement('div');
            player2.className = 'player';
            const sourceMatchNum2 = parseInt(sources[1].matchId.substring(sources[1].matchId.indexOf('m') + 1)) + 1;
            const sourceRound2 = parseInt(sources[1].matchId.substring(1, sources[1].matchId.indexOf('m')));

            // Get the round name for more specific winner text
            let roundName2 = TournamentUtils.getRoundName(sourceRound2, numRounds, config);

            player2.textContent = `Winner of ${roundName2} Match ${sourceMatchNum2}`;
            player2.addEventListener('click', TournamentEvents.handlePlayerClick.bind(TournamentEvents));

            matchElement.appendChild(player1);
            matchElement.appendChild(player2);
          }

          // Track which match in the next round this match feeds into
          if (round < numRounds - 1) {
            // For intermediate rounds and finals, calculate which match in the next round this feeds into
            // Standard pairing for binary tournament
            const nextRoundMatch = Math.floor(match / 2);
            const nextMatchId = `r${round + 1}m${nextRoundMatch}`;

            if (!matchSources[nextMatchId]) {
              matchSources[nextMatchId] = [];
            }
            matchSources[nextMatchId].push({
              matchId,
              isUpper: match % 2 === 0
            });
          }
        }

        // Store the match element for later connector creation
        matchesByRound[round][match] = matchElement;

        column.appendChild(matchElement);
      }

      container.appendChild(column);
    }

    // Add column names to the DOM and position them
    setTimeout(() => {
      const columns = document.querySelectorAll('.bracket-column');
      columns.forEach((column, index) => {
        const round = parseInt(column.dataset.round);

        // Skip the champion column (last round)
        if (round === numRounds - 1) {
          return;
        }

        const columnRect = column.getBoundingClientRect();
        const columnName = document.createElement('div');
        columnName.className = 'column-name';

        // Set the column name based on the round
        let columnNameText = TournamentUtils.getRoundName(round, numRounds, config);

        columnName.innerHTML = columnNameText + ' <span class="check-mark">✓</span>';
        columnName.dataset.round = round;

        // Position the column name under the center of the column
        const centerX = columnRect.left + columnRect.width / 2;
        columnName.style.left = `${centerX}px`;

        document.body.appendChild(columnName);
      });

      // Update column name positions when zooming or panning
      const updateColumnNamePositions = TournamentDOM.updateColumnNamePositions;

      // Add event listeners for zoom and pan events
      const zoomContent = document.querySelector('.zoom-content');

      // Use MutationObserver to detect changes to the transform style
      const observer = new MutationObserver(updateColumnNamePositions);
      observer.observe(zoomContent, { attributes: true, attributeFilter: ['style'] });

      // Also update positions on window resize
      window.addEventListener('resize', updateColumnNamePositions);

      // Initialize check marks for all rounds
      for (let i = 0; i < numRounds; i++) {
        TournamentEvents.checkRoundCompletion(i);
      }
    }, 100);

    // Create curved connectors between match pairings and their next-level match
    // For each match, find its sources and create connectors
    for (let round = 1; round < numRounds; round++) {
      for (let match = 0; match < matchesByRound[round].length; match++) {
        const targetMatch = matchesByRound[round][match];
        const targetMatchId = `r${round}m${match}`;
        const sources = matchSources[targetMatchId] || [];

        // Create connectors for each source
        for (const source of sources) {
          // Find the source match element
          const sourceRound = parseInt(source.matchId.substring(1, source.matchId.indexOf('m')));
          const sourceMatch = parseInt(source.matchId.substring(source.matchId.indexOf('m') + 1));
          const sourceMatchElement = matchesByRound[sourceRound][sourceMatch];

          // Create curved connector between this match and its target
          const curvedConnector = TournamentDOM.createCurvedConnector(sourceMatchElement, targetMatch, container, source.isUpper);
          container.appendChild(curvedConnector);
        }
      }
    }
  }
};

// Alpine.js component for bracket viewer with zoom and drag functionality
function bracketViewer() {
  return {
    scale: 1,
    translateX: 0,
    translateY: 0,
    initialTranslateX: 0,
    initialTranslateY: 0,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    lastDistance: 0,

    // Mouse drag handlers
    startDrag(e) {
      if (e.button !== 0) return; // Only left mouse button
      this.isDragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.$refs.container.classList.add('grabbing');
      e.preventDefault();
    },

    drag(e) {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.lastX;
      const deltaY = e.clientY - this.lastY;
      this.translateX += deltaX;
      this.translateY += deltaY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      e.preventDefault();
    },

    stopDrag() {
      this.isDragging = false;
      this.$refs.container.classList.remove('grabbing');
    },

    // Touch drag handlers
    startTouchDrag(e) {
      if (e.touches.length === 1) {
        // Single touch for dragging
        this.isDragging = true;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        // Two touches for pinch zoom
        this.lastDistance = this.getTouchDistance(e);
      }
      e.preventDefault();
    },

    touchDrag(e) {
      if (e.touches.length === 1 && this.isDragging) {
        // Single touch drag
        const deltaX = e.touches[0].clientX - this.lastX;
        const deltaY = e.touches[0].clientY - this.lastY;
        this.translateX += deltaX;
        this.translateY += deltaY;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        // Pinch zoom
        const currentDistance = this.getTouchDistance(e);
        const delta = currentDistance - this.lastDistance;

        if (Math.abs(delta) > 5) {
          // Calculate zoom center point
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          const centerX = (touch1.clientX + touch2.clientX) / 2;
          const centerY = (touch1.clientY + touch2.clientY) / 2;

          // Zoom in or out
          const zoomDirection = delta > 0 ? 1 : -1;
          this.zoomAtPoint(centerX, centerY, zoomDirection * 0.05);

          this.lastDistance = currentDistance;
        }
      }
      e.preventDefault();
    },

    // Helper for touch distance
    getTouchDistance(e) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      return Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    },

    // Mouse wheel zoom
    zoom(e) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.zoomAtPoint(e.clientX, e.clientY, delta);
      e.preventDefault();
    },

    // Zoom at specific point
    zoomAtPoint(clientX, clientY, delta) {
      // Get container bounds
      const rect = this.$refs.container.getBoundingClientRect();

      // Calculate mouse position relative to container
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Calculate mouse position in scaled content space
      const contentX = (x - this.translateX) / this.scale;
      const contentY = (y - this.translateY) / this.scale;

      // Calculate new scale with limits
      const newScale = Math.max(0.5, Math.min(3, this.scale + delta));

      // Calculate new translate values to zoom at mouse position
      if (newScale !== this.scale) {
        this.translateX = x - contentX * newScale;
        this.translateY = y - contentY * newScale;
        this.scale = newScale;
      }
    },

    // Reset zoom and center
    resetZoom() {
      this.scale = 1;

      // Center the bracket in the viewport
      const container = this.$refs.container;
      const content = this.$refs.content;

      if (container && content) {
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const contentWidth = content.scrollWidth;
        const contentHeight = content.scrollHeight;

        this.translateX = (containerWidth - contentWidth) / 2;
        this.translateY = (containerHeight - contentHeight) / 2;

        // Store the initial centered position
        this.initialTranslateX = this.translateX;
        this.initialTranslateY = this.translateY;
      } else {
        this.translateX = 0;
        this.translateY = 0;
        this.initialTranslateX = 0;
        this.initialTranslateY = 0;
      }
    }
  };
}

// Initialize the tournament when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Only initialize if we're on the brackets page
  if (document.getElementById('tournament-container')) {
    // Initialize tournament configuration
    const config = TournamentConfig.initialize();

    // Get the generator function based on tournament type
    const tournamentType = config.type;
    const typeConfig = TournamentConfig.tournamentTypes[tournamentType];

    if (typeConfig && TournamentGenerator[typeConfig.generator]) {
      // Generate the bracket based on the configuration
      TournamentGenerator[typeConfig.generator](config);

      // Prevent default touch behavior on the zoom container to avoid conflicts
      const zoomContainer = document.querySelector('.zoom-container');
      if (zoomContainer) {
        zoomContainer.addEventListener('touchstart', function(e) {
          // Allow default behavior for buttons
          if (e.target.tagName === 'BUTTON') return;
          e.preventDefault();
        }, { passive: false });
      }

      // Update player count display
      const playerCountElement = document.getElementById('player-count');
      if (playerCountElement) {
        playerCountElement.textContent = config.playerCount;
      }

      // Update the page title and heading to include the tournament type
      document.title = `${typeConfig.name} - Nexus Tournament`;

      // Update the tournament type in the heading and info section
      const tournamentTypeElement = document.getElementById('tournament-type');
      if (tournamentTypeElement) {
        tournamentTypeElement.textContent = typeConfig.name;
      }

      const tournamentTypeInfoElement = document.getElementById('tournament-type-info');
      if (tournamentTypeInfoElement) {
        tournamentTypeInfoElement.textContent = typeConfig.name;
      }
    } else {
      console.error(`Tournament generator for type "${tournamentType}" not found.`);
    }
  }
});
