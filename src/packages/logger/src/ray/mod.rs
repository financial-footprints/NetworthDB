use std::cell::RefCell;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RayState {
    pub ray_id: String,
    pub actor_id: Option<String>,
}

thread_local! {
    static CONTEXT_STACK: RefCell<Vec<RayState>> = const { RefCell::new(Vec::new()) };
}

pub fn push(ray_id: String) {
    CONTEXT_STACK.with(|stack| {
        stack.borrow_mut().push(RayState {
            ray_id,
            actor_id: None,
        });
    });
}

pub fn pop() {
    CONTEXT_STACK.with(|stack| {
        stack.borrow_mut().pop();
    });
}

#[cfg(any(feature = "napi", test))]
pub fn set_actor_id(actor_id: String) {
    CONTEXT_STACK.with(|stack| {
        if let Some(context) = stack.borrow_mut().last_mut() {
            context.actor_id = Some(actor_id);
        }
    });
}

pub fn current() -> Option<RayState> {
    CONTEXT_STACK.with(|stack| stack.borrow().last().cloned())
}

pub fn current_ray_id() -> Option<String> {
    current().map(|context| context.ray_id)
}

#[cfg(any(feature = "napi", test))]
pub fn require_ray_id() -> Result<String, &'static str> {
    match current() {
        Some(context) if !context.ray_id.trim().is_empty() => Ok(context.ray_id),
        _ => Err("logger.ray.require.error.missing-ray-id"),
    }
}

pub async fn scope<F, T>(ray_id: &str, future: F) -> T
where
    F: std::future::Future<Output = T>,
{
    push(ray_id.to_string());
    let result = future.await;
    pop();
    result
}

#[cfg(test)]
mod test_ray;
