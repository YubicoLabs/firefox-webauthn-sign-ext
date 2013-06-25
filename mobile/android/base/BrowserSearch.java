/* -*- Mode: Java; c-basic-offset: 4; tab-width: 20; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import org.mozilla.gecko.db.BrowserContract.Combined;
import org.mozilla.gecko.db.BrowserDB;
import org.mozilla.gecko.db.BrowserDB.URLColumns;
import org.mozilla.gecko.gfx.BitmapUtils;
import org.mozilla.gecko.util.GeckoEventListener;
import org.mozilla.gecko.util.ThreadUtils;
import org.mozilla.gecko.home.FaviconsLoader;
import org.mozilla.gecko.home.HomeFragment;
import org.mozilla.gecko.home.HomeListView;
import org.mozilla.gecko.home.TwoLinePageRow;
import org.mozilla.gecko.widget.FaviconView;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.support.v4.app.Fragment;
import android.support.v4.app.LoaderManager;
import android.support.v4.app.LoaderManager.LoaderCallbacks;
import android.support.v4.content.AsyncTaskLoader;
import android.support.v4.content.Loader;
import android.text.TextUtils;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.LayoutInflater;
import android.widget.AdapterView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.SimpleCursorAdapter;
import android.widget.TextView;

import java.util.ArrayList;

/**
 * Fragment that displays frecency search results in a ListView.
 */
public class BrowserSearch extends HomeFragment
                           implements AdapterView.OnItemClickListener,
                                      GeckoEventListener {
    // Logging tag name
    private static final String LOGTAG = "GeckoBrowserSearch";

    // Cursor loader ID for search query
    private static final int SEARCH_LOADER_ID = 0;

    // Cursor loader ID for favicons query
    private static final int FAVICONS_LOADER_ID = 1;

    // AsyncTask loader ID for suggestion query
    private static final int SUGGESTION_LOADER_ID = 2;

    // Timeout for the suggestion client to respond
    private static final int SUGGESTION_TIMEOUT = 3000;

    // Maximum number of results returned by the suggestion client
    private static final int SUGGESTION_MAX = 3;

    // Holds the current search term to use in the query
    private String mSearchTerm;

    // Adapter for the list of search results
    private SearchAdapter mAdapter;

    // The view shown by the fragment.
    private ListView mList;

    // Client that performs search suggestion queries
    private SuggestClient mSuggestClient;

    // List of search engines from gecko
    private ArrayList<SearchEngine> mSearchEngines;

    // Whether search suggestions are enabled or not
    private boolean mSuggestionsEnabled;

    // Callbacks used for the search and favicon cursor loaders
    private CursorLoaderCallbacks mCursorLoaderCallbacks;

    // Callbacks used for the search suggestion loader
    private SuggestionLoaderCallbacks mSuggestionLoaderCallbacks;

    // Inflater used by the adapter
    private LayoutInflater mInflater;

    // On URL open listener
    private OnUrlOpenListener mUrlOpenListener;

    // On search listener
    private OnSearchListener mSearchListener;

    // On edit suggestion listener
    private OnEditSuggestionListener mEditSuggestionListener;

    public interface OnUrlOpenListener {
        public void onUrlOpen(String url);
    }

    public interface OnSearchListener {
        public void onSearch(SearchEngine engine, String text);
    }

    public interface OnEditSuggestionListener {
        public void onEditSuggestion(String suggestion);
    }

    public static BrowserSearch newInstance() {
        return new BrowserSearch();
    }

    public BrowserSearch() {
        mSearchTerm = "";
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        registerEventListener("SearchEngines:Data");

        // The search engines list is reused beyond the life-cycle of
        // this fragment.
        if (mSearchEngines == null) {
            mSearchEngines = new ArrayList<SearchEngine>();
            GeckoAppShell.sendEventToGecko(GeckoEvent.createBroadcastEvent("SearchEngines:Get", null));
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterEventListener("SearchEngines:Data");
    }

    @Override
    public void onAttach(Activity activity) {
        super.onAttach(activity);

        try {
            mUrlOpenListener = (OnUrlOpenListener) activity;
        } catch (ClassCastException e) {
            throw new ClassCastException(activity.toString()
                    + " must implement BrowserSearch.OnUrlOpenListener");
        }

        try {
            mSearchListener = (OnSearchListener) activity;
        } catch (ClassCastException e) {
            throw new ClassCastException(activity.toString()
                    + " must implement BrowserSearch.OnSearchListener");
        }

        try {
            mEditSuggestionListener = (OnEditSuggestionListener) activity;
        } catch (ClassCastException e) {
            throw new ClassCastException(activity.toString()
                    + " must implement BrowserSearch.OnEditSuggestionListener");
        }

        mInflater = (LayoutInflater) activity.getSystemService(Context.LAYOUT_INFLATER_SERVICE);
    }

    @Override
    public void onDetach() {
        super.onDetach();

        mUrlOpenListener = null;
        mSearchListener = null;
        mEditSuggestionListener = null;
    }

    @Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container, Bundle savedInstanceState) {
        // All list views are styled to look the same with a global activity theme.
        // If the style of the list changes, inflate it from an XML.
        mList = new HomeListView(container.getContext());
        return mList;
    }

    @Override
    public void onViewCreated(View view, Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        mList.setOnItemClickListener(this);
        registerForContextMenu(mList);
    }

    @Override
    public void onActivityCreated(Bundle savedInstanceState) {
        super.onActivityCreated(savedInstanceState);

        // Intialize the search adapter
        mAdapter = new SearchAdapter(getActivity());
        mList.setAdapter(mAdapter);

        // Only create an instance when we need it
        mSuggestionLoaderCallbacks = null;

        // Create callbacks before the initial loader is started
        mCursorLoaderCallbacks = new CursorLoaderCallbacks();

        // Reconnect to the loader only if present
        getLoaderManager().initLoader(SEARCH_LOADER_ID, null, mCursorLoaderCallbacks);
    }

    @Override
    public void handleMessage(String event, final JSONObject message) {
        if (event.equals("SearchEngines:Data")) {
            ThreadUtils.postToUiThread(new Runnable() {
                @Override
                public void run() {
                    setSearchEngines(message);
                }
            });
        }
    }

    private void filterSuggestions() {
        if (mSuggestClient == null || !mSuggestionsEnabled) {
            return;
        }

        if (mSuggestionLoaderCallbacks == null) {
            mSuggestionLoaderCallbacks = new SuggestionLoaderCallbacks();
        }

        getLoaderManager().restartLoader(SUGGESTION_LOADER_ID, null, mSuggestionLoaderCallbacks);
    }

    private void setSuggestions(ArrayList<String> suggestions) {
        mSearchEngines.get(0).suggestions = suggestions;
        mAdapter.notifyDataSetChanged();
    }

    private void setSearchEngines(JSONObject data) {
        try {
            final JSONObject suggest = data.getJSONObject("suggest");
            final String suggestEngine = suggest.optString("engine", null);
            final String suggestTemplate = suggest.optString("template", null);
            final boolean suggestionsPrompted = suggest.getBoolean("prompted");
            final JSONArray engines = data.getJSONArray("searchEngines");

            mSuggestionsEnabled = suggest.getBoolean("enabled");

            ArrayList<SearchEngine> searchEngines = new ArrayList<SearchEngine>();
            for (int i = 0; i < engines.length(); i++) {
                final JSONObject engineJSON = engines.getJSONObject(i);
                final String name = engineJSON.getString("name");
                final String identifier = engineJSON.getString("identifier");
                final String iconURI = engineJSON.getString("iconURI");
                final Bitmap icon = BitmapUtils.getBitmapFromDataURI(iconURI);

                if (name.equals(suggestEngine) && suggestTemplate != null) {
                    // Suggest engine should be at the front of the list
                    searchEngines.add(0, new SearchEngine(name, identifier, icon));

                    // The only time Tabs.getInstance().getSelectedTab() should
                    // be null is when we're restoring after a crash. We should
                    // never restore private tabs when that happens, so it
                    // should be safe to assume that null means non-private.
                    Tab tab = Tabs.getInstance().getSelectedTab();
                    if (tab == null || !tab.isPrivate()) {
                        mSuggestClient = new SuggestClient(getActivity(), suggestTemplate,
                                SUGGESTION_TIMEOUT, SUGGESTION_MAX);
                    }
                } else {
                    searchEngines.add(new SearchEngine(name, identifier, icon));
                }
            }

            mSearchEngines = searchEngines;

            if (mAdapter != null) {
                mAdapter.notifyDataSetChanged();
            }

            // FIXME: restore suggestion opt-in UI
        } catch (JSONException e) {
            Log.e(LOGTAG, "Error getting search engine JSON", e);
        }

        filterSuggestions();
    }

    private void registerEventListener(String eventName) {
        GeckoAppShell.getEventDispatcher().registerEventListener(eventName, this);
    }

    private void unregisterEventListener(String eventName) {
        GeckoAppShell.getEventDispatcher().unregisterEventListener(eventName, this);
    }

    @Override
    public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
        final Cursor c = mAdapter.getCursor();
        if (c == null || !c.moveToPosition(position)) {
            return;
        }

        final String url = c.getString(c.getColumnIndexOrThrow(URLColumns.URL));
        mUrlOpenListener.onUrlOpen(url);
    }

    public void filter(String searchTerm) {
        if (TextUtils.isEmpty(searchTerm)) {
            return;
        }

        if (TextUtils.equals(mSearchTerm, searchTerm)) {
            return;
        }

        mSearchTerm = searchTerm;

        if (isVisible()) {
            // The adapter depends on the search term to determine its number
            // of items. Make it we notify the view about it.
            mAdapter.notifyDataSetChanged();

            // Restart loaders with the new search term
            getLoaderManager().restartLoader(SEARCH_LOADER_ID, null, mCursorLoaderCallbacks);
            filterSuggestions();
        }
    }

    private static class SearchCursorLoader extends SimpleCursorLoader {
        // Max number of search results
        private static final int SEARCH_LIMIT = 100;

        // The target search term associated with the loader
        private final String mSearchTerm;

        public SearchCursorLoader(Context context, String searchTerm) {
            super(context);
            mSearchTerm = searchTerm;
        }

        @Override
        public Cursor loadCursor() {
            if (TextUtils.isEmpty(mSearchTerm)) {
                return null;
            }

            final ContentResolver cr = getContext().getContentResolver();
            return BrowserDB.filter(cr, mSearchTerm, SEARCH_LIMIT);
        }
    }

    private static class SuggestionAsyncLoader extends AsyncTaskLoader<ArrayList<String>> {
        private final SuggestClient mSuggestClient;
        private final String mSearchTerm;
        private ArrayList<String> mSuggestions;

        public SuggestionAsyncLoader(Context context, SuggestClient suggestClient, String searchTerm) {
            super(context);
            mSuggestClient = suggestClient;
            mSearchTerm = searchTerm;
            mSuggestions = null;
        }

        @Override
        public ArrayList<String> loadInBackground() {
            return mSuggestClient.query(mSearchTerm);
        }

        @Override
        public void deliverResult(ArrayList<String> suggestions) {
            mSuggestions = suggestions;

            if (isStarted()) {
                super.deliverResult(mSuggestions);
            }
        }

        @Override
        protected void onStartLoading() {
            if (mSuggestions != null) {
                deliverResult(mSuggestions);
            }

            if (takeContentChanged() || mSuggestions == null) {
                forceLoad();
            }
        }

        @Override
        protected void onStopLoading() {
            cancelLoad();
        }

        @Override
        protected void onReset() {
            super.onReset();

            onStopLoading();
            mSuggestions = null;
        }
    }

    private class SearchAdapter extends SimpleCursorAdapter {
        private static final int ROW_SEARCH = 0;
        private static final int ROW_STANDARD = 1;
        private static final int ROW_SUGGEST = 2;

        private static final int ROW_TYPE_COUNT = 3;

        public SearchAdapter(Context context) {
            super(context, -1, null, new String[] {}, new int[] {});
        }

        @Override
        public int getItemViewType(int position) {
            final int engine = getEngineIndex(position);

            if (engine == -1) {
                return ROW_STANDARD;
            } else if (engine == 0 && mSuggestionsEnabled) {
                // Give suggestion views their own type to prevent them from
                // sharing other recycled search engine views. Using other
                // recycled views for the suggestion row can break animations
                // (bug 815937).
                return ROW_SUGGEST;
            }

            return ROW_SEARCH;
        }

        @Override
        public int getViewTypeCount() {
            // view can be either a standard awesomebar row, a search engine
            // row, or a suggestion row
            return ROW_TYPE_COUNT;
        }

        @Override
        public boolean isEnabled(int position) {
            // If the suggestion row only contains one item (the user-entered
            // query), allow the entire row to be clickable; clicking the row
            // has the same effect as clicking the single suggestion. If the
            // row contains multiple items, clicking the row will do nothing.
            final int index = getEngineIndex(position);
            if (index != -1) {
                return mSearchEngines.get(index).suggestions.isEmpty();
            }

            return true;
        }

        // Add the search engines to the number of reported results.
        @Override
        public int getCount() {
            final int resultCount = super.getCount();

            // Don't show search engines or suggestions if search field is empty
            if (TextUtils.isEmpty(mSearchTerm)) {
                return resultCount;
            }

            return resultCount + mSearchEngines.size();
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            final int type = getItemViewType(position);

            if (type == ROW_SEARCH || type == ROW_SUGGEST) {
                final SearchEngineRow row;
                if (convertView == null) {
                    row = (SearchEngineRow) mInflater.inflate(R.layout.home_search_item_row, mList, false);
                    row.setOnUrlOpenListener(mUrlOpenListener);
                    row.setOnSearchListener(mSearchListener);
                    row.setOnEditSuggestionListener(mEditSuggestionListener);
                } else {
                    row = (SearchEngineRow) convertView;
                }

                row.setSearchTerm(mSearchTerm);

                final SearchEngine engine = mSearchEngines.get(getEngineIndex(position));
                row.updateFromSearchEngine(engine);

                return row;
            } else {
                final TwoLinePageRow row;
                if (convertView == null) {
                    row = (TwoLinePageRow) mInflater.inflate(R.layout.home_item_row, mList, false);
                } else {
                    row = (TwoLinePageRow) convertView;
                }

                // Account for the search engines
                position -= getSuggestEngineCount();

                final Cursor c = getCursor();
                if (!c.moveToPosition(position)) {
                    throw new IllegalStateException("Couldn't move cursor to position " + position);
                }

                row.updateFromCursor(c);

                return row;
            }
        }

        private int getSuggestEngineCount() {
            return (TextUtils.isEmpty(mSearchTerm) || mSuggestClient == null || !mSuggestionsEnabled) ? 0 : 1;
        }

        private int getEngineIndex(int position) {
            final int resultCount = super.getCount();
            final int suggestEngineCount = getSuggestEngineCount();

            // Return suggest engine index
            if (position < suggestEngineCount) {
                return position;
            }

            // Not an engine
            if (position - suggestEngineCount < resultCount) {
                return -1;
            }

            // Return search engine index
            return position - resultCount;
        }
    }

    private class CursorLoaderCallbacks implements LoaderCallbacks<Cursor> {
        @Override
        public Loader<Cursor> onCreateLoader(int id, Bundle args) {
            switch(id) {
            case SEARCH_LOADER_ID:
                return new SearchCursorLoader(getActivity(), mSearchTerm);

            case FAVICONS_LOADER_ID:
                return FaviconsLoader.createInstance(getActivity(), args);
            }

            return null;
        }

        @Override
        public void onLoadFinished(Loader<Cursor> loader, Cursor c) {
            final int loaderId = loader.getId();
            switch(loaderId) {
            case SEARCH_LOADER_ID:
                mAdapter.swapCursor(c);

                FaviconsLoader.restartFromCursor(getLoaderManager(), FAVICONS_LOADER_ID,
                        mCursorLoaderCallbacks, c);
                break;

            case FAVICONS_LOADER_ID:
                // Causes the listview to recreate its children and use the
                // now in-memory favicons.
                mAdapter.notifyDataSetChanged();
                break;
            }
        }

        @Override
        public void onLoaderReset(Loader<Cursor> loader) {
            final int loaderId = loader.getId();
            switch(loaderId) {
            case SEARCH_LOADER_ID:
                mAdapter.swapCursor(null);
                break;

            case FAVICONS_LOADER_ID:
                // Do nothing
                break;
            }
        }
    }

    private class SuggestionLoaderCallbacks implements LoaderCallbacks<ArrayList<String>> {
        @Override
        public Loader<ArrayList<String>> onCreateLoader(int id, Bundle args) {
            return new SuggestionAsyncLoader(getActivity(), mSuggestClient, mSearchTerm);
        }

        @Override
        public void onLoadFinished(Loader<ArrayList<String>> loader, ArrayList<String> suggestions) {
            setSuggestions(suggestions);
        }

        @Override
        public void onLoaderReset(Loader<ArrayList<String>> loader) {
            setSuggestions(new ArrayList<String>());
        }
    }
}