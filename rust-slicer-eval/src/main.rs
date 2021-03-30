#![feature(rustc_private, in_band_lifetimes)]
  
use anyhow::{Context, Error, Result};
use clap::clap_app;
use generate_rustc_flags::generate_rustc_flags;
use log::debug;

use crate::visitor::EvalCrateVisitor;

extern crate rustc_driver;
extern crate rustc_hir;
extern crate rustc_interface;
extern crate rustc_middle;
extern crate rustc_mir;
extern crate rustc_span;

mod visitor;

struct Callbacks;

impl rustc_driver::Callbacks for Callbacks {
  fn after_analysis<'tcx>(
    &mut self,
    _compiler: &rustc_interface::interface::Compiler,
    queries: &'tcx rustc_interface::Queries<'tcx>,
  ) -> rustc_driver::Compilation {
    queries.global_ctxt().unwrap().take().enter(|tcx| {
      let mut eval_visitor = EvalCrateVisitor::new(tcx);
      tcx.hir().krate().par_visit_all_item_likes(&mut eval_visitor);
      println!("{}", serde_json::to_string(&eval_visitor.eval_results).unwrap());
    });

    rustc_driver::Compilation::Stop
  }
}

fn run() -> Result<()> {
  let _ = env_logger::try_init();

  let matches = clap_app!(app =>
    (@arg path:)
  )
  .get_matches();

  let source_path = matches.value_of("path").context("Missing path")?;
  let flags = generate_rustc_flags(source_path)?;
  debug!("Rustc command:\n{}", flags.join(" "));

  let mut callbacks = Callbacks;
  rustc_driver::catch_fatal_errors(|| rustc_driver::RunCompiler::new(&flags, &mut callbacks).run())
    .map_err(|_| Error::msg("rustc panicked"))?
    .map_err(|_| Error::msg("driver failed"))?;



  Ok(())
}

fn main() {
  run().unwrap();
}