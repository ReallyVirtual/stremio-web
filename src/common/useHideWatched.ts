// Copyright (C) 2017-2026 Smart code 203358507

import useStoredFlag from './useStoredFlag';

// "Hide watched items" is a client preference: it hides items core marks as watched
// from the Board rows, Discover, Search and Library.
const useHideWatched = () => useStoredFlag('hideWatched');

export default useHideWatched;
