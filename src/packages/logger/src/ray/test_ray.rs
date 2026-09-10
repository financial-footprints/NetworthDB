use super::RayState;

#[test]
fn current_is_empty_outside_a_scope() {
    assert_eq!(super::current(), None);
}

#[test]
fn push_sets_ray_id() {
    super::push("req-123".to_string());

    assert_eq!(
        super::current(),
        Some(RayState {
            ray_id: "req-123".to_string(),
            actor_id: None,
        })
    );

    super::pop();
}

#[test]
fn set_actor_id_enriches_the_active_scope() {
    super::push("req-789".to_string());
    super::set_actor_id("user-1".to_string());

    assert_eq!(
        super::current(),
        Some(RayState {
            ray_id: "req-789".to_string(),
            actor_id: Some("user-1".to_string()),
        })
    );

    super::pop();
}

#[test]
fn nested_scopes_restore_previous_context() {
    super::push("outer".to_string());
    super::set_actor_id("actor-outer".to_string());

    super::push("inner".to_string());
    super::set_actor_id("actor-inner".to_string());

    assert_eq!(
        super::current(),
        Some(RayState {
            ray_id: "inner".to_string(),
            actor_id: Some("actor-inner".to_string()),
        })
    );

    super::pop();

    assert_eq!(
        super::current(),
        Some(RayState {
            ray_id: "outer".to_string(),
            actor_id: Some("actor-outer".to_string()),
        })
    );

    super::pop();
    assert_eq!(super::current(), None);
}

#[test]
fn require_ray_id_returns_active_ray_id() {
    super::push("req-456".to_string());

    assert_eq!(super::require_ray_id(), Ok("req-456".to_string()));

    super::pop();
}

#[test]
fn require_ray_id_fails_outside_a_scope() {
    assert_eq!(super::require_ray_id(), Err("request rayId is missing"));
}
