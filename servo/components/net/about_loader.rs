/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

use net_traits::{LoadData, Metadata};
use net_traits::ProgressMsg::Done;
use mime_classifier::MIMEClassifier;
use resource_task::start_sending;
use file_loader;

use url::Url;
use hyper::http::RawStatus;
use util::resource_files::resources_dir_path;

use std::borrow::IntoCow;
use std::fs::PathExt;
use std::sync::Arc;

pub fn factory(mut load_data: LoadData, classifier: Arc<MIMEClassifier>) {
    match load_data.url.non_relative_scheme_data().unwrap() {
        "blank" => {
            let start_chan = load_data.consumer;
            let chan = start_sending(start_chan, Metadata {
                final_url: load_data.url,
                content_type: Some(("text".to_string(), "html".to_string())),
                charset: Some("utf-8".to_string()),
                headers: None,
                status: Some(RawStatus(200, "OK".into_cow())),
            });
            chan.send(Done(Ok(()))).unwrap();
            return
        }
        "crash" => panic!("Loading the about:crash URL."),
        "failure" => {
            let mut path = resources_dir_path();
            path.push("failure.html");
            assert!(path.exists());
            load_data.url = Url::from_file_path(&*path).unwrap();
        }
        _ => {
            let start_chan = load_data.consumer;
            start_sending(start_chan, Metadata::default(load_data.url))
                .send(Done(Err("Unknown about: URL.".to_string()))).unwrap();
            return
        }
    };
    file_loader::factory(load_data, classifier)
}
